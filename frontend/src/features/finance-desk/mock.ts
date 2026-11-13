import { recordAudit, studentTarget } from "@/features/admin-system/mock-log";
import { AuditAction } from "@/features/admin-system/schema";
import { mockNameOf, requireMockOffice } from "@/features/auth/mock-token";
import { findMockLine, localized, toLineSummary } from "@/features/lines/mock-builders";
import { PaymentStatus, type Payment } from "@/features/payments/schema";
import {
  findMockStudentRecord,
  mockStudentRecords,
  type MockStudentRecord,
} from "@/features/subscriptions/mock-desk-students";
import {
  MOCK_HOLD_MS,
  bookingOf,
  newMockId,
  paymentsOf,
  saveBooking,
  savePayments,
  studentsWithPayments,
  type MockBooking,
  type MockPayment,
} from "@/features/subscriptions/mock-state";
import { SubscriptionStatus } from "@/features/subscriptions/schema";
import { ServerErrorCode } from "@/lib/api/errors";
import { mockFileUrl } from "@/lib/api/mock/file-store";
import { MockHttpError, registerMock } from "@/lib/api/mock/mock-server";
import { sampleReceiptImage } from "@/lib/api/mock/sample-files";
import { Role } from "@/lib/auth/roles";
import {
  findAwaitingPaymentEndpoint,
  getOfficePaymentEndpoint,
  listOfficePaymentsEndpoint,
  recordOfficePaymentEndpoint,
  reviewPaymentEndpoint,
} from "./api";
import { FinanceErrorCode, ReviewDecision, type DeskStudent, type OfficePayment } from "./schema";

const HTTP = { NotFound: 404, Conflict: 409, Unprocessable: 422 };
const DEFAULT_PAGE_SIZE = 20;
const FINANCE = [Role.Finance];

const iso = (time: number) => new Date(time).toISOString();

interface Owned {
  student: MockStudentRecord;
  payment: MockPayment;
}

function toDeskStudent(student: MockStudentRecord, language: string): DeskStudent {
  return {
    student_id: student.id,
    name: localized(language, student.nameAr, student.nameEn),
    identifier: student.identifier,
    phone: student.phone,
  };
}

/** A receipt as the student sees it; finance's view adds to it. */
function toPayment(payment: MockPayment, language: string): Payment {
  return {
    payment_id: payment.paymentId,
    subscription_id: payment.subscriptionId,
    method: payment.method,
    reference_number: payment.referenceNumber,
    amount_piasters: payment.amountPiasters,
    paid_on: payment.paidOn,
    payer_name: payment.payerName,
    file_name: payment.fileName,
    submitted_at: iso(payment.submittedAt),
    status: payment.status,
    rejection_reason: payment.rejectionReason
      ? localized(language, payment.rejectionReason.ar, payment.rejectionReason.en)
      : null,
    reviewed_at: payment.reviewedAt === null ? null : iso(payment.reviewedAt),
  };
}

function seatOf(booking: MockBooking, language: string) {
  const line = findMockLine(booking.lineId);
  if (!line) throw new Error(`Unknown mock line ${booking.lineId}`);
  const [, stopAr = "", stopEn = ""] = line.stops[booking.stopOrder - 1] ?? [];
  return { line: toLineSummary(line, language), stop_name: localized(language, stopAr, stopEn) };
}

const PIASTERS_PER_POUND = 100;

/** The uploaded file, or a sample slip for a seeded receipt that was never really uploaded. */
function fileOf(payment: MockPayment): { url: string; contentType: string } | null {
  if (payment.fileName === null) return null;
  return (
    mockFileUrl(payment.paymentId) ?? {
      url: sampleReceiptImage({
        reference: payment.referenceNumber,
        amount: `EGP ${(payment.amountPiasters / PIASTERS_PER_POUND).toLocaleString("en-US")}`,
        payer: payment.payerName,
        paidOn: payment.paidOn,
      }),
      contentType: "image/svg+xml",
    }
  );
}

function toOfficePayment({ student, payment }: Owned, language: string): OfficePayment {
  const booking = bookingOf(student.id);
  if (!booking) throw new Error(`No booking for ${student.id}`);
  return {
    ...toPayment(payment, language),
    student: toDeskStudent(student, language),
    ...seatOf(booking, language),
    price_piasters: booking.pricePiasters,
    subscription_status: booking.status,
    reviewed_by_name: payment.reviewedBy
      ? localized(language, payment.reviewedBy.ar, payment.reviewedBy.en)
      : null,
    file_url: fileOf(payment)?.url ?? null,
    file_content_type: fileOf(payment)?.contentType ?? null,
  };
}

/** Every receipt the mock server holds, with its student. */
function allPayments(): Owned[] {
  return studentsWithPayments().flatMap((studentId) => {
    const student = findMockStudentRecord(studentId);
    if (!student || !bookingOf(studentId)) return [];
    return paymentsOf(studentId).map((payment) => ({ student, payment }));
  });
}

function findPayment(paymentId: string): Owned {
  const found = allPayments().find(({ payment }) => payment.paymentId === paymentId);
  if (!found) throw new MockHttpError(HTTP.NotFound, ServerErrorCode.NotFound, "No such payment.");
  return found;
}

function matchesSearch({ student, payment }: Owned, q: string | undefined): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return [student.identifier, student.nameAr, student.nameEn, payment.referenceNumber].some(
    (value) => value.toLowerCase().includes(needle),
  );
}

/** Waiting first, the oldest at the top; then decisions, the newest at the top. */
function byQueueOrder(a: Owned, b: Owned): number {
  const aWaiting = a.payment.status === PaymentStatus.PendingReview;
  const bWaiting = b.payment.status === PaymentStatus.PendingReview;
  if (aWaiting !== bWaiting) return aWaiting ? -1 : 1;
  if (aWaiting) return a.payment.submittedAt - b.payment.submittedAt;
  return (b.payment.reviewedAt ?? 0) - (a.payment.reviewedAt ?? 0);
}

registerMock(listOfficePaymentsEndpoint, ({ query }, { token, language }) => {
  requireMockOffice(token, FINANCE);
  const searched = allPayments().filter((item) => matchesSearch(item, query.q));
  const counts = { pending_review: 0, approved: 0, rejected: 0 };
  for (const { payment } of searched) counts[payment.status] += 1;
  const filtered = searched
    .filter(({ payment }) => !query.status || payment.status === query.status)
    .sort(byQueueOrder);
  const page = query.page ?? 1;
  const pageSize = query.page_size ?? DEFAULT_PAGE_SIZE;
  return {
    items: filtered
      .slice((page - 1) * pageSize, page * pageSize)
      .map((item) => toOfficePayment(item, language)),
    total: filtered.length,
    counts,
  };
});

registerMock(getOfficePaymentEndpoint, ({ params }, { token, language }) => {
  requireMockOffice(token, FINANCE);
  const found = findPayment(params.payment_id);
  const others = paymentsOf(found.student.id)
    .filter((payment) => payment.paymentId !== found.payment.paymentId)
    .sort((a, b) => b.submittedAt - a.submittedAt)
    .map((payment) => toPayment(payment, language));
  return { ...toOfficePayment(found, language), other_payments: others };
});

registerMock(reviewPaymentEndpoint, ({ params, body }, { token, language }) => {
  const officer = requireMockOffice(token, FINANCE);
  const { student, payment } = findPayment(params.payment_id);
  if (payment.status !== PaymentStatus.PendingReview) {
    throw new MockHttpError(
      HTTP.Conflict,
      FinanceErrorCode.AlreadyReviewed,
      "This receipt was already reviewed.",
    );
  }
  const reason = body.reason?.trim() ?? "";
  if (body.decision === ReviewDecision.Reject && !reason) {
    throw new MockHttpError(HTTP.Unprocessable, FinanceErrorCode.ReasonRequired, "Say why.");
  }
  const now = Date.now();
  const approved = body.decision === ReviewDecision.Approve;
  const reviewed: MockPayment = {
    ...payment,
    status: approved ? PaymentStatus.Approved : PaymentStatus.Rejected,
    rejectionReason: approved ? null : { ar: reason, en: reason },
    reviewedAt: now,
    reviewedBy: mockNameOf(officer),
  };
  savePayments(
    student.id,
    paymentsOf(student.id).map((item) => (item.paymentId === payment.paymentId ? reviewed : item)),
  );
  const booking = bookingOf(student.id);
  if (booking?.subscriptionId === payment.subscriptionId) {
    saveBooking(
      student.id,
      approved
        ? { ...booking, status: SubscriptionStatus.Active, holdExpiresAt: null, activatedAt: now }
        : { ...booking, status: SubscriptionStatus.Reserved, holdExpiresAt: now + MOCK_HOLD_MS },
    );
  }
  recordAudit(
    officer,
    approved ? AuditAction.PaymentApproved : AuditAction.PaymentRejected,
    studentTarget(student, payment.referenceNumber),
    approved ? null : reason,
    now,
  );
  return toOfficePayment({ student, payment: reviewed }, language);
});

function requireAwaitingBooking(student: MockStudentRecord): MockBooking {
  const booking = bookingOf(student.id);
  if (booking?.status === SubscriptionStatus.Expired) {
    throw new MockHttpError(HTTP.Conflict, FinanceErrorCode.HoldExpired, "The hold expired.");
  }
  if (booking?.status !== SubscriptionStatus.Reserved) {
    throw new MockHttpError(
      HTTP.Conflict,
      FinanceErrorCode.NotAwaitingPayment,
      "No booking waiting for a payment.",
    );
  }
  return booking;
}

registerMock(findAwaitingPaymentEndpoint, ({ query }, { token, language }) => {
  requireMockOffice(token, FINANCE);
  const typed = query.identifier.trim();
  const student = mockStudentRecords().find((item) => item.identifier === typed);
  if (!student) {
    throw new MockHttpError(HTTP.NotFound, FinanceErrorCode.StudentNotFound, "No such student.");
  }
  const booking = requireAwaitingBooking(student);
  return {
    student: toDeskStudent(student, language),
    subscription_id: booking.subscriptionId,
    subscription_status: booking.status,
    ...seatOf(booking, language),
    price_piasters: booking.pricePiasters,
    hold_expires_at: booking.holdExpiresAt === null ? null : iso(booking.holdExpiresAt),
  };
});

registerMock(recordOfficePaymentEndpoint, ({ body }, { token, language }) => {
  const officer = requireMockOffice(token, FINANCE);
  const student = mockStudentRecords().find(
    (item) => bookingOf(item.id)?.subscriptionId === body.subscription_id,
  );
  if (!student) {
    throw new MockHttpError(HTTP.NotFound, ServerErrorCode.NotFound, "No such booking.");
  }
  const booking = requireAwaitingBooking(student);
  if (body.amount_piasters < booking.pricePiasters) {
    throw new MockHttpError(
      HTTP.Unprocessable,
      FinanceErrorCode.AmountMismatch,
      "The amount is less than the term price.",
    );
  }
  const reference = body.reference_number.trim().toUpperCase();
  const used = allPayments().some(
    ({ payment }) =>
      payment.referenceNumber.toUpperCase() === reference &&
      payment.status !== PaymentStatus.Rejected,
  );
  if (used) {
    throw new MockHttpError(
      HTTP.Conflict,
      FinanceErrorCode.ReceiptAlreadyUsed,
      "This slip number is already recorded.",
    );
  }
  const now = Date.now();
  const payment: MockPayment = {
    paymentId: newMockId("pay"),
    subscriptionId: booking.subscriptionId,
    method: "card_at_office",
    referenceNumber: body.reference_number.trim(),
    amountPiasters: body.amount_piasters,
    paidOn: body.paid_on,
    payerName: body.payer_name.trim(),
    fileName: null,
    submittedAt: now,
    status: PaymentStatus.Approved,
    rejectionReason: null,
    reviewedAt: now,
    reviewedBy: mockNameOf(officer),
  };
  savePayments(student.id, [...paymentsOf(student.id), payment]);
  recordAudit(
    officer,
    AuditAction.OfficePayment,
    studentTarget(student, payment.referenceNumber),
    null,
    now,
  );
  saveBooking(student.id, {
    ...booking,
    status: SubscriptionStatus.Active,
    holdExpiresAt: null,
    activatedAt: now,
  });
  return toOfficePayment({ student, payment }, language);
});
