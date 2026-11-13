import { localized, MOCK_TERM_PRICE_PIASTERS } from "@/features/lines/mock-builders";
import { requireMockStudent } from "@/features/subscriptions/mock";
import {
  MockPaymentStatus,
  bookingOf,
  newMockId,
  paymentsOf,
  saveBooking,
  savePayments,
  type MockPayment,
} from "@/features/subscriptions/mock-state";
import { SubscriptionStatus } from "@/features/subscriptions/schema";
import { saveMockFile } from "@/lib/api/mock/file-store";
import { MockHttpError, registerMock } from "@/lib/api/mock/mock-server";
import {
  getPaymentInstructionsEndpoint,
  listMyPaymentsEndpoint,
  submitReceiptEndpoint,
} from "./api";
import { PaymentErrorCode, RECEIPT_CONTENT_TYPES, RECEIPT_MAX_BYTES, type Payment } from "./schema";

const HTTP = { Conflict: 409, TooLarge: 413, Unprocessable: 422 };
const BASE64_BYTES_PER_CHAR = 3 / 4;

/** The university's account, exactly as printed on the Fall 2026 registration letter. */
const BANK = {
  bank_name: { ar: "البنك الأهلي المصري", en: "National Bank of Egypt" },
  account_name: { ar: "جامعة السويدي للتكنولوجيا", en: "El Sewedy University of Technology" },
  account_number: "0013071554203502020",
  iban: "EG080003000130715542035020200",
  swift_code: "NBEGEGCXXXX",
  currency: "EGP",
};

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
    submitted_at: new Date(payment.submittedAt).toISOString(),
    status: payment.status,
    rejection_reason: payment.rejectionReason
      ? localized(language, payment.rejectionReason.ar, payment.rejectionReason.en)
      : null,
    reviewed_at: payment.reviewedAt === null ? null : new Date(payment.reviewedAt).toISOString(),
  };
}

registerMock(getPaymentInstructionsEndpoint, (_input, { token, language }) => {
  requireMockStudent(token);
  return {
    amount_piasters: MOCK_TERM_PRICE_PIASTERS,
    bank: {
      ...BANK,
      bank_name: localized(language, BANK.bank_name.ar, BANK.bank_name.en),
      account_name: localized(language, BANK.account_name.ar, BANK.account_name.en),
    },
    cashier_room: "A045",
    transport_room: "A039",
    office_hours: localized(
      language,
      "من الأحد للخميس، من 9 الصبح لـ 4 العصر",
      "Sunday to Thursday, 9:00 AM to 4:00 PM",
    ),
    receipt_max_bytes: RECEIPT_MAX_BYTES,
    receipt_content_types: [...RECEIPT_CONTENT_TYPES],
  };
});

registerMock(listMyPaymentsEndpoint, (_input, { token, language }) => {
  const { user } = requireMockStudent(token);
  bookingOf(user.id); // applies any review that is due
  return paymentsOf(user.id).map((payment) => toPayment(payment, language));
});

registerMock(submitReceiptEndpoint, ({ body }, { token, language }) => {
  const { user } = requireMockStudent(token);
  const booking = bookingOf(user.id);
  if (!booking || booking.subscriptionId !== body.subscription_id) {
    throw new MockHttpError(HTTP.Conflict, PaymentErrorCode.NotAwaitingPayment, "No booking.");
  }
  if (booking.status === SubscriptionStatus.Expired) {
    throw new MockHttpError(HTTP.Conflict, PaymentErrorCode.HoldExpired, "The hold expired.");
  }
  if (booking.status !== SubscriptionStatus.Reserved) {
    throw new MockHttpError(
      HTTP.Conflict,
      PaymentErrorCode.NotAwaitingPayment,
      "This booking isn't waiting for a payment.",
    );
  }
  if (body.receipt.data_base64.length * BASE64_BYTES_PER_CHAR > RECEIPT_MAX_BYTES) {
    throw new MockHttpError(HTTP.TooLarge, PaymentErrorCode.ReceiptTooLarge, "File too large.");
  }
  if (body.amount_piasters < booking.pricePiasters) {
    throw new MockHttpError(
      HTTP.Unprocessable,
      PaymentErrorCode.AmountMismatch,
      "The amount is less than the term price.",
    );
  }
  const reference = body.reference_number.trim().toUpperCase();
  const used = paymentsOf(user.id).some(
    (payment) =>
      payment.referenceNumber.toUpperCase() === reference &&
      payment.status !== MockPaymentStatus.Rejected,
  );
  if (used) {
    throw new MockHttpError(
      HTTP.Conflict,
      PaymentErrorCode.ReceiptAlreadyUsed,
      "This receipt was already used.",
    );
  }
  const payment: MockPayment = {
    paymentId: newMockId("pay"),
    subscriptionId: booking.subscriptionId,
    method: body.method,
    referenceNumber: body.reference_number.trim(),
    amountPiasters: body.amount_piasters,
    paidOn: body.paid_on,
    payerName: body.payer_name.trim(),
    fileName: body.receipt.file_name,
    submittedAt: Date.now(),
    status: MockPaymentStatus.PendingReview,
    rejectionReason: null,
    reviewedAt: null,
  };
  saveMockFile(payment.paymentId, body.receipt.content_type, body.receipt.data_base64);
  savePayments(user.id, [...paymentsOf(user.id), payment]);
  saveBooking(user.id, {
    ...booking,
    status: SubscriptionStatus.PaymentReview,
    holdExpiresAt: null,
  });
  return toPayment(payment, language);
});
