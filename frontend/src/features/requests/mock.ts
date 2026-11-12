import { findMockLine, localized, mockStopId, toLineSummary } from "@/features/lines/mock-builders";
import {
  hasMockGuardianAccount,
  requireMockGuardian,
  requireMockGuardianOf,
  mockChildrenOf,
} from "@/features/children/mock-links";
import { LineErrorCode } from "@/features/lines/schema";
import { PaymentErrorCode, RECEIPT_MAX_BYTES, type ReceiptFile } from "@/features/payments/schema";
import { mockTerm, requireMockStudent } from "@/features/subscriptions/mock";
import {
  MOCK_TERM,
  MockPaymentStatus,
  bookingOf,
  newMockId,
  paymentsOf,
  saveBooking,
} from "@/features/subscriptions/mock-state";
import { SubscriptionStatus } from "@/features/subscriptions/schema";
import { ServerErrorCode } from "@/lib/api/errors";
import { MockHttpError, registerMock } from "@/lib/api/mock/mock-server";
import { todayInCairo } from "@/lib/format";
import {
  createComplaintEndpoint,
  createLineChangeEndpoint,
  createModelPermitEndpoint,
  createRefundEndpoint,
  getRefundPolicyEndpoint,
  getRequestEndpoint,
  approveAsGuardianEndpoint,
  listGuardianApprovalsEndpoint,
  listMyRequestsEndpoint,
  refuseAsGuardianEndpoint,
  withdrawRequestEndpoint,
} from "./api";
import {
  nextReference,
  requestsOf,
  saveRequests,
  type MockAttachment,
  type MockRequest,
  type MockRequestPayload,
  type MockText,
} from "./mock-state";
import { guardianAnswerOf, officeStartOf, statusAt } from "./mock-status";
import { deductionOn, isRefundWindowOpen, refundAmount } from "./refund-policy";
import {
  ComplaintCategory,
  EXCEPTIONAL_REFUND_REASONS,
  LineChangeDuration,
  OPEN_REQUEST_STATUSES,
  RequestActor,
  RequestErrorCode,
  RequestKind,
  RequestStatus,
  type RefundWindow,
  type RequestEvent,
  WITHDRAWABLE_REQUEST_STATUSES,
  type GuardianApproval,
  type StudentRequest,
} from "./schema";

const HTTP = { NotFound: 404, Conflict: 409, TooLarge: 413, Unprocessable: 422 };

/** The Fall 2026 refund table (Refund Policy 2026-2027, first semester). */
const MOCK_REFUND_WINDOWS: readonly RefundWindow[] = [
  { from: "2026-09-20", to: "2026-10-08", deduction_percent: 25 },
  { from: "2026-10-11", to: "2026-10-29", deduction_percent: 50 },
  { from: "2026-11-01", to: null, deduction_percent: 100 },
];
const PAYOUT_DAYS = 45;
const PROCESSING_DAYS = 3;

const iso = (time: number) => new Date(time).toISOString();

/**
 * The office that handles a request: finance for refunds and payment complaints, the
 * Transportation office for the rest.
 */
export function officeActorOf(payload: MockRequestPayload): RequestEvent["by"] {
  const isFinance =
    payload.kind === RequestKind.Refund ||
    (payload.kind === RequestKind.Complaint && payload.category === ComplaintCategory.Payment);
  return isFinance ? RequestActor.Finance : RequestActor.TransportOffice;
}

/** Who gives the final answer: the handling office, or Safety for a model permit. */
function deciderOf(payload: MockRequestPayload): RequestEvent["by"] {
  return payload.kind === RequestKind.ModelPermit ? RequestActor.Safety : officeActorOf(payload);
}

function timelineOf(request: MockRequest, now: number, language: string): RequestEvent[] {
  const note = (text: MockText | null) => (text ? localized(language, text.ar, text.en) : null);
  const events: RequestEvent[] = [
    {
      status: request.guardian ? RequestStatus.AwaitingGuardian : RequestStatus.Submitted,
      at: iso(request.submittedAt),
      by: RequestActor.Student,
      note: null,
    },
  ];
  const answer = guardianAnswerOf(request, now);
  if (answer && (request.withdrawnAt === null || answer.at < request.withdrawnAt)) {
    events.push({
      status: answer.approved ? RequestStatus.Submitted : RequestStatus.Rejected,
      at: iso(answer.at),
      by: RequestActor.Guardian,
      note: answer.note,
    });
  }
  if (request.withdrawnAt !== null) {
    events.push({
      status: RequestStatus.Withdrawn,
      at: iso(request.withdrawnAt),
      by: RequestActor.Student,
      note: null,
    });
    return events;
  }
  const step = request.office;
  if (!step || officeStartOf(request, now) === null) return events;
  events.push({
    status: RequestStatus.InReview,
    at: iso(step.openedAt),
    by: officeActorOf(request.payload),
    note: note(step.openNote),
  });
  if (step.decision && step.decidedAt !== null) {
    events.push({
      status: step.decision,
      at: iso(step.decidedAt),
      by: deciderOf(request.payload),
      note: note(step.note),
    });
  }
  return events;
}

function lineSummary(lineId: string, language: string) {
  const line = findMockLine(lineId);
  if (!line) throw new Error(`Unknown mock line ${lineId}`);
  return toLineSummary(line, language);
}

function toAttachments(list: readonly MockAttachment[]) {
  return list.map((item) => ({
    attachment_id: item.attachmentId,
    file_name: item.fileName,
    content_type: item.contentType,
    size_bytes: item.sizeBytes,
  }));
}

function detailsOf(request: MockRequest, language: string) {
  const { payload } = request;
  switch (payload.kind) {
    case RequestKind.LineChange: {
      const line = findMockLine(payload.toLineId);
      const [, nameAr = "", nameEn = ""] = line?.stops[payload.toStopOrder - 1] ?? [];
      return {
        kind: payload.kind,
        details: {
          from_line: lineSummary(payload.fromLineId, language),
          to_line: lineSummary(payload.toLineId, language),
          to_stop: {
            stop_id: mockStopId(payload.toLineId, payload.toStopOrder),
            name: localized(language, nameAr, nameEn),
          },
          duration: payload.duration,
          starts_on: payload.startsOn,
          ends_on: payload.endsOn,
          reason: payload.reason,
          student_phone: payload.studentPhone,
          guardian_name: payload.guardianName,
          guardian_phone: payload.guardianPhone,
        },
      };
    }
    case RequestKind.Refund:
      return {
        kind: payload.kind,
        details: {
          subscription_id: payload.subscriptionId,
          reason: payload.reason,
          explanation: payload.explanation,
          paid_piasters: payload.paidPiasters,
          deduction_percent: payload.deductionPercent,
          estimated_refund_piasters: payload.estimatedRefundPiasters,
          approved_refund_piasters:
            request.office?.decision === RequestStatus.Approved
              ? request.office.refundPiasters
              : null,
          guardian_name: payload.guardianName,
          guardian_phone: payload.guardianPhone,
          attachments: toAttachments(payload.attachments),
        },
      };
    case RequestKind.Complaint:
      return {
        kind: payload.kind,
        details: {
          category: payload.category,
          line: payload.lineId ? lineSummary(payload.lineId, language) : null,
          happened_on: payload.happenedOn,
          description: payload.description,
          attachments: toAttachments(payload.attachments),
        },
      };
    case RequestKind.ModelPermit: {
      const line = findMockLine(payload.lineId);
      if (!line) throw new Error(`Unknown mock line ${payload.lineId}`);
      const { student } = payload;
      return {
        kind: payload.kind,
        details: {
          student_name: localized(language, student.name.ar, student.name.en),
          university_id: student.universityId,
          faculty: student.faculty
            ? localized(language, student.faculty.ar, student.faculty.en)
            : null,
          level: student.level,
          line: toLineSummary(line, language),
          bus_type: line.busType,
          // Driver names and phones are not in the mock on purpose (see mock-lines.ts).
          driver_name: null,
          driver_phone: null,
          material: payload.material,
          dimensions: payload.dimensions,
          purpose: payload.purpose,
          purpose_other: payload.purposeOther,
          destination: payload.destination,
          entry_date: payload.entryDate,
          entry_time: payload.entryTime,
          exit_date: payload.exitDate,
          exit_time: payload.exitTime,
          supervisor_name: payload.supervisorName,
        },
      };
    }
  }
}

export function toStudentRequest(
  request: MockRequest,
  language: string,
  now = Date.now(),
): StudentRequest {
  const timeline = timelineOf(request, now, language);
  return {
    request_id: request.requestId,
    reference: request.reference,
    status: statusAt(request, now),
    submitted_at: iso(request.submittedAt),
    updated_at: timeline.at(-1)?.at ?? iso(request.submittedAt),
    timeline,
    ...detailsOf(request, language),
  } as StudentRequest;
}

/** Applies what an approval changes: a permanent line change moves the booking. */
function applyDecisions(userId: string, list: MockRequest[], now: number): MockRequest[] {
  const today = todayInCairo(new Date(now));
  let changed = false;
  const settled = list.map((request) => {
    if (request.appliedAt !== null || statusAt(request, now) !== RequestStatus.Approved) {
      return request;
    }
    const { payload } = request;
    const booking = bookingOf(userId, now);
    if (payload.kind === RequestKind.LineChange) {
      if (payload.duration !== LineChangeDuration.Permanent || payload.startsOn > today) {
        return request;
      }
      if (booking?.status === SubscriptionStatus.Active) {
        saveBooking(userId, {
          ...booking,
          lineId: payload.toLineId,
          stopOrder: payload.toStopOrder,
        });
      }
    } else if (
      payload.kind === RequestKind.Refund &&
      booking?.status === SubscriptionStatus.Active
    ) {
      saveBooking(userId, {
        ...booking,
        status: SubscriptionStatus.Cancelled,
        holdExpiresAt: null,
      });
    }
    changed = true;
    return { ...request, appliedAt: now };
  });
  if (changed) saveRequests(userId, settled);
  return settled;
}

/** The student's requests with time-based changes applied. Also used by the notifications mock. */
export function currentRequestsOf(userId: string, now = Date.now()): MockRequest[] {
  return applyDecisions(userId, requestsOf(userId), now);
}

function hasOpenRequest(userId: string, kind: RequestKind, now: number): boolean {
  return currentRequestsOf(userId, now).some(
    (request) =>
      request.payload.kind === kind && OPEN_REQUEST_STATUSES.includes(statusAt(request, now)),
  );
}

function requireActiveBooking(userId: string) {
  const booking = bookingOf(userId);
  if (!booking || booking.status !== SubscriptionStatus.Active) {
    throw new MockHttpError(
      HTTP.Conflict,
      RequestErrorCode.NoActiveSubscription,
      "You need an active subscription for this request.",
    );
  }
  return booking;
}

function rejectIfOpen(userId: string, kind: RequestKind, now: number) {
  if (hasOpenRequest(userId, kind, now)) {
    throw new MockHttpError(
      HTTP.Conflict,
      RequestErrorCode.RequestAlreadyOpen,
      "You already have an open request of this kind.",
    );
  }
}

function invalidDates(message: string): MockHttpError {
  return new MockHttpError(HTTP.Unprocessable, RequestErrorCode.InvalidDates, message);
}

/** Decoded size of a base64 file, as the server would measure it. */
function decodedBytes(file: ReceiptFile): number {
  const BASE64_RATIO = 3 / 4;
  return Math.floor(file.data_base64.length * BASE64_RATIO);
}

function storeFiles(files: readonly ReceiptFile[]): MockAttachment[] {
  return files.map((file) => {
    const sizeBytes = decodedBytes(file);
    if (sizeBytes > RECEIPT_MAX_BYTES) {
      throw new MockHttpError(HTTP.TooLarge, PaymentErrorCode.ReceiptTooLarge, "File too large.");
    }
    return {
      attachmentId: newMockId("att"),
      fileName: file.file_name,
      contentType: file.content_type,
      sizeBytes,
    };
  });
}

function addRequest(userId: string, request: Omit<MockRequest, "requestId" | "reference">) {
  const stored: MockRequest = {
    ...request,
    requestId: newMockId("req"),
    reference: nextReference(),
  };
  saveRequests(userId, [...requestsOf(userId), stored]);
  return stored;
}

/** Approved refunds are paid in full pounds: the paid amount minus the day's deduction. */
function paidThisTerm(userId: string, subscriptionId: string): number {
  return paymentsOf(userId)
    .filter(
      (payment) =>
        payment.subscriptionId === subscriptionId && payment.status === MockPaymentStatus.Approved,
    )
    .reduce((sum, payment) => sum + payment.amountPiasters, 0);
}

registerMock(listMyRequestsEndpoint, ({ query }, { token, language }) => {
  const { user } = requireMockStudent(token);
  const now = Date.now();
  return currentRequestsOf(user.id, now)
    .filter((request) => !query.kind || request.payload.kind === query.kind)
    .sort((a, b) => b.submittedAt - a.submittedAt || b.reference.localeCompare(a.reference))
    .map((request) => toStudentRequest(request, language, now));
});

registerMock(getRequestEndpoint, ({ params }, { token, language }) => {
  const { user } = requireMockStudent(token);
  const request = currentRequestsOf(user.id).find((item) => item.requestId === params.request_id);
  if (!request)
    throw new MockHttpError(HTTP.NotFound, ServerErrorCode.NotFound, "No such request.");
  return toStudentRequest(request, language);
});

registerMock(createLineChangeEndpoint, ({ body }, { token, language }) => {
  const { user } = requireMockStudent(token);
  const now = Date.now();
  const booking = requireActiveBooking(user.id);
  rejectIfOpen(user.id, RequestKind.LineChange, now);
  if (body.to_line_id === booking.lineId) {
    throw new MockHttpError(HTTP.Unprocessable, RequestErrorCode.SameLine, "That's your line.");
  }
  const line = findMockLine(body.to_line_id);
  if (!line) throw new MockHttpError(HTTP.NotFound, LineErrorCode.LineNotFound, "No such line.");
  const stopIndex = line.stops.findIndex(
    (_stop, index) => mockStopId(line.lineId, index + 1) === body.to_stop_id,
  );
  if (stopIndex < 0) {
    throw new MockHttpError(HTTP.Unprocessable, "STOP_NOT_ON_LINE", "That stop isn't on the line.");
  }
  const today = todayInCairo(new Date(now));
  if (body.starts_on < today) throw invalidDates("The change can't start in the past.");
  if (body.ends_on !== null && body.ends_on < body.starts_on) {
    throw invalidDates("The end date is before the start date.");
  }
  if (body.starts_on > MOCK_TERM.ends_on || (body.ends_on ?? "") > MOCK_TERM.ends_on) {
    throw invalidDates("The dates are after the end of the term.");
  }

  const stored = addRequest(user.id, {
    submittedAt: now,
    withdrawnAt: null,
    appliedAt: null,
    guardian: {
      hasAccount: hasMockGuardianAccount(user.id),
      decidedAt: null,
      approved: false,
      note: null,
    },
    payload: {
      kind: RequestKind.LineChange,
      fromLineId: booking.lineId,
      toLineId: line.lineId,
      toStopOrder: stopIndex + 1,
      duration: body.duration,
      startsOn: body.starts_on,
      endsOn: body.ends_on,
      reason: body.reason,
      studentPhone: body.student_phone,
      guardianName: body.guardian_name,
      guardianPhone: body.guardian_phone,
    },
  });
  return toStudentRequest(stored, language, now);
});

registerMock(createRefundEndpoint, ({ body }, { token, language }) => {
  const { user } = requireMockStudent(token);
  const now = Date.now();
  const booking = requireActiveBooking(user.id);
  if (booking.subscriptionId !== body.subscription_id) {
    throw new MockHttpError(HTTP.NotFound, ServerErrorCode.NotFound, "No such subscription.");
  }
  rejectIfOpen(user.id, RequestKind.Refund, now);
  const deduction = deductionOn(MOCK_REFUND_WINDOWS, todayInCairo(new Date(now)));
  const isExceptional = EXCEPTIONAL_REFUND_REASONS.includes(body.reason);
  if (!isExceptional && !isRefundWindowOpen(deduction)) {
    throw new MockHttpError(
      HTTP.Unprocessable,
      RequestErrorCode.RefundWindowClosed,
      "Ordinary refunds are closed for this term.",
    );
  }
  if (isExceptional && body.documents.length === 0) {
    throw new MockHttpError(
      HTTP.Unprocessable,
      RequestErrorCode.DocumentsRequired,
      "Attach the supporting document.",
    );
  }
  const paid = paidThisTerm(user.id, booking.subscriptionId);
  const estimate = isExceptional ? null : refundAmount(paid, deduction);
  const stored = addRequest(user.id, {
    submittedAt: now,
    withdrawnAt: null,
    appliedAt: null,
    payload: {
      kind: RequestKind.Refund,
      subscriptionId: booking.subscriptionId,
      reason: body.reason,
      explanation: body.explanation,
      paidPiasters: paid,
      deductionPercent: deduction,
      estimatedRefundPiasters: estimate,
      guardianName: body.guardian_name,
      guardianPhone: body.guardian_phone,
      attachments: storeFiles(body.documents),
    },
  });
  return toStudentRequest(stored, language, now);
});

registerMock(createComplaintEndpoint, ({ body }, { token, language }) => {
  const { user } = requireMockStudent(token);
  const now = Date.now();
  const booking = bookingOf(user.id, now);
  if (body.category === ComplaintCategory.Payment) {
    if (!booking) {
      throw new MockHttpError(
        HTTP.Conflict,
        RequestErrorCode.NoSubscription,
        "Book a seat before complaining about a payment.",
      );
    }
  } else {
    requireActiveBooking(user.id);
  }
  if (body.line_id !== null && !findMockLine(body.line_id)) {
    throw new MockHttpError(HTTP.NotFound, LineErrorCode.LineNotFound, "No such line.");
  }
  if (body.happened_on > todayInCairo(new Date(now)) || body.happened_on < MOCK_TERM.starts_on) {
    throw invalidDates("The date must be this term and not in the future.");
  }
  const stored = addRequest(user.id, {
    submittedAt: now,
    withdrawnAt: null,
    appliedAt: null,
    payload: {
      kind: RequestKind.Complaint,
      category: body.category,
      lineId: body.line_id,
      happenedOn: body.happened_on,
      description: body.description,
      attachments: storeFiles(body.attachments),
    },
  });
  return toStudentRequest(stored, language, now);
});

registerMock(createModelPermitEndpoint, ({ body }, { token, language }) => {
  const { user } = requireMockStudent(token);
  const now = Date.now();
  const booking = requireActiveBooking(user.id);
  rejectIfOpen(user.id, RequestKind.ModelPermit, now);
  if (body.entry_date < todayInCairo(new Date(now))) {
    throw invalidDates("The model can't come in on a day that has passed.");
  }
  if (body.exit_date > MOCK_TERM.ends_on) {
    throw invalidDates("The dates are after the end of the term.");
  }
  const stored = addRequest(user.id, {
    submittedAt: now,
    withdrawnAt: null,
    appliedAt: null,
    payload: {
      kind: RequestKind.ModelPermit,
      student: {
        name: { ar: user.name_ar ?? user.name, en: user.name },
        universityId: user.identifier,
        faculty: user.faculty ? { ar: user.faculty_ar ?? user.faculty, en: user.faculty } : null,
        level: user.level ?? null,
      },
      lineId: booking.lineId,
      material: body.material,
      dimensions: body.dimensions,
      purpose: body.purpose,
      purposeOther: body.purpose_other,
      destination: body.destination,
      entryDate: body.entry_date,
      entryTime: body.entry_time,
      exitDate: body.exit_date,
      exitTime: body.exit_time,
      supervisorName: body.supervisor_name,
    },
  });
  return toStudentRequest(stored, language, now);
});

registerMock(withdrawRequestEndpoint, ({ params }, { token, language }) => {
  const { user } = requireMockStudent(token);
  const now = Date.now();
  const list = currentRequestsOf(user.id, now);
  const request = list.find((item) => item.requestId === params.request_id);
  if (!request)
    throw new MockHttpError(HTTP.NotFound, ServerErrorCode.NotFound, "No such request.");
  if (!WITHDRAWABLE_REQUEST_STATUSES.includes(statusAt(request, now))) {
    throw new MockHttpError(
      HTTP.Conflict,
      RequestErrorCode.NotWithdrawable,
      "The office has already started on this request.",
    );
  }
  const withdrawn = { ...request, withdrawnAt: now };
  saveRequests(
    user.id,
    list.map((item) => (item === request ? withdrawn : item)),
  );
  return toStudentRequest(withdrawn, language, now);
});

registerMock(getRefundPolicyEndpoint, (_input, { token, language }) => {
  const { user } = requireMockStudent(token);
  const booking = bookingOf(user.id);
  const isActive = booking?.status === SubscriptionStatus.Active;
  return {
    term_name: mockTerm(language).name,
    windows: [...MOCK_REFUND_WINDOWS],
    today_deduction_percent: deductionOn(MOCK_REFUND_WINDOWS, todayInCairo()),
    paid_piasters: isActive ? paidThisTerm(user.id, booking.subscriptionId) : null,
    subscription_id: isActive ? booking.subscriptionId : null,
    payout_days: PAYOUT_DAYS,
    processing_days: PROCESSING_DAYS,
  };
});

/** A child's line changes, the ones a guardian answers. */
function lineChangesOf(studentId: string, now: number): MockRequest[] {
  return currentRequestsOf(studentId, now).filter(
    (request) => request.payload.kind === RequestKind.LineChange && request.guardian,
  );
}

/** Mock only: the line changes waiting for this guardian (for the notifications mock). */
export function awaitingGuardianOf(guardianId: string, now = Date.now()) {
  return mockChildrenOf(guardianId).flatMap((child) =>
    lineChangesOf(child.user.id, now)
      .filter((request) => statusAt(request, now) === RequestStatus.AwaitingGuardian)
      .map((request) => ({ child, request })),
  );
}

/** A guardian may change their answer this long after giving it (and before the office acts). */
const GUARDIAN_CHANGE_MS = 10 * 60 * 1000;

/** Until when the guardian may still change their answer, or null. */
function changeableUntil(userId: string, request: MockRequest, now: number): number | null {
  const step = request.guardian;
  if (!step || step.decidedAt === null || request.withdrawnAt !== null) return null;
  const until = step.decidedAt + GUARDIAN_CHANGE_MS;
  if (now >= until) return null;
  const status = statusAt(request, now);
  // Approved: only until the office opens it. Refused: only if no newer request replaced it.
  if (step.approved) return status === RequestStatus.Submitted ? until : null;
  const replaced = currentRequestsOf(userId, now).some(
    (other) =>
      other.requestId !== request.requestId &&
      other.payload.kind === RequestKind.LineChange &&
      other.submittedAt > request.submittedAt,
  );
  return status === RequestStatus.Rejected && !replaced ? until : null;
}

registerMock(listGuardianApprovalsEndpoint, (_input, { token, language }) => {
  const guardian = requireMockGuardian(token);
  const now = Date.now();
  const approvals: GuardianApproval[] = mockChildrenOf(guardian.user.id)
    .flatMap((child) =>
      lineChangesOf(child.user.id, now).map((request) => {
        const until = changeableUntil(child.user.id, request, now);
        return {
          student_id: child.user.id,
          student_name: localized(language, child.user.name_ar ?? child.user.name, child.user.name),
          request: toStudentRequest(request, language, now),
          can_change_until: until === null ? null : iso(until),
        };
      }),
    )
    .sort((a, b) => b.request.submitted_at.localeCompare(a.request.submitted_at));
  return { approvals };
});

function answerAsGuardian(
  token: string | null,
  requestId: string,
  approved: boolean,
  note: string | null,
  language: string,
): StudentRequest {
  const guardian = requireMockGuardian(token);
  const now = Date.now();
  const owner = mockChildrenOf(guardian.user.id).find((child) =>
    requestsOf(child.user.id).some((request) => request.requestId === requestId),
  );
  if (!owner) {
    // Same answer as for someone else's child: the guardian can't tell the request exists.
    requireMockGuardianOf(token, "");
    throw new Error("unreachable");
  }
  const list = currentRequestsOf(owner.user.id, now);
  const request = list.find((item) => item.requestId === requestId);
  const isWaiting = request?.guardian && statusAt(request, now) === RequestStatus.AwaitingGuardian;
  const mayChange =
    request?.guardian &&
    request.guardian.approved !== approved &&
    changeableUntil(owner.user.id, request, now) !== null;
  if (!request?.guardian || (!isWaiting && !mayChange)) {
    throw new MockHttpError(
      HTTP.Conflict,
      RequestErrorCode.NotAwaitingGuardian,
      "This request isn't waiting for you any more.",
    );
  }
  const answered: MockRequest = {
    ...request,
    guardian: { ...request.guardian, decidedAt: now, approved, note: note?.trim() || null },
  };
  saveRequests(
    owner.user.id,
    list.map((item) => (item === request ? answered : item)),
  );
  return toStudentRequest(answered, language, now);
}

registerMock(approveAsGuardianEndpoint, ({ params, body }, { token, language }) =>
  answerAsGuardian(token, params.request_id, true, body.note, language),
);

registerMock(refuseAsGuardianEndpoint, ({ params, body }, { token, language }) =>
  answerAsGuardian(token, params.request_id, false, body.note, language),
);
