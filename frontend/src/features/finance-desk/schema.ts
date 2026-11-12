import { z } from "zod";
import { lineSummarySchema } from "@/features/lines/schema";
import {
  PAYER_NAME_MAX_LENGTH,
  PaymentStatus,
  REFERENCE_MAX_LENGTH,
  paymentSchema,
} from "@/features/payments/schema";
import { SubscriptionStatus, calendarDateSchema } from "@/features/subscriptions/schema";

/**
 * Finance's side of paying for a seat (agreement, "Student: booking, payment and the card"):
 * review the bank receipts students upload, and record a Visa payment taken at the Accounting
 * office (A045). Approving activates the subscription; rejecting gives the seat a fresh
 * 24-hour hold so the student can upload again.
 */

export const ReviewDecision = {
  Approve: "approve",
  Reject: "reject",
} as const;
export type ReviewDecision = (typeof ReviewDecision)[keyof typeof ReviewDecision];

export const FinanceErrorCode = {
  /** Someone in finance already decided this receipt. */
  AlreadyReviewed: "PAYMENT_ALREADY_REVIEWED",
  /** A rejection must tell the student what to fix. */
  ReasonRequired: "REASON_REQUIRED",
  StudentNotFound: "STUDENT_NOT_FOUND",
  /** The student has no booking waiting for a payment. */
  NotAwaitingPayment: "NOT_AWAITING_PAYMENT",
  HoldExpired: "HOLD_EXPIRED",
  AmountMismatch: "AMOUNT_MISMATCH",
  ReceiptAlreadyUsed: "RECEIPT_ALREADY_USED",
} as const;
export type FinanceErrorCode = (typeof FinanceErrorCode)[keyof typeof FinanceErrorCode];

export const REJECTION_REASON_MIN_LENGTH = 5;
export const REJECTION_REASON_MAX_LENGTH = 300;
const SEARCH_MAX_LENGTH = 60;
const PAGE_SIZE_MAX = 50;

const PAYMENT_STATUSES = [
  PaymentStatus.PendingReview,
  PaymentStatus.Approved,
  PaymentStatus.Rejected,
] as const;

const SUBSCRIPTION_STATUSES = [
  SubscriptionStatus.Reserved,
  SubscriptionStatus.PaymentReview,
  SubscriptionStatus.Active,
  SubscriptionStatus.Expired,
  SubscriptionStatus.Cancelled,
] as const;

/** Who paid, as finance needs them: name (request's language), university ID and phone. */
export const deskStudentSchema = z.object({
  student_id: z.string(),
  name: z.string(),
  identifier: z.string(),
  phone: z.string(),
});
export type DeskStudent = z.infer<typeof deskStudentSchema>;

/** A receipt (or a Visa payment) with the student, the seat and who reviewed it. */
export const officePaymentSchema = paymentSchema.extend({
  student: deskStudentSchema,
  line: lineSummarySchema,
  stop_name: z.string(),
  /** The term price fixed at booking, to compare with the amount on the receipt. */
  price_piasters: z.number().int().nonnegative(),
  subscription_status: z.enum(SUBSCRIPTION_STATUSES),
  /** The finance officer who decided or recorded it; null while waiting. */
  reviewed_by_name: z.string().nullable(),
  /**
   * A short-lived link to the uploaded file (image or PDF). Null for a Visa payment and in the
   * demo, which doesn't keep files.
   */
  file_url: z.url().nullable(),
});
export type OfficePayment = z.infer<typeof officePaymentSchema>;

export const officePaymentListQuerySchema = z.object({
  status: z.enum(PAYMENT_STATUSES).optional(),
  /** University ID, part of the name, or the receipt's reference number. */
  q: z.string().trim().max(SEARCH_MAX_LENGTH).optional(),
  page: z.number().int().positive().optional(),
  page_size: z.number().int().positive().max(PAGE_SIZE_MAX).optional(),
});
export type OfficePaymentListQuery = z.input<typeof officePaymentListQuerySchema>;

export const officePaymentListSchema = z.object({
  /** Waiting first (oldest first, so nobody waits longest), then newest decisions. */
  items: z.array(officePaymentSchema),
  total: z.number().int().nonnegative(),
  /** For the tabs, whatever the filter. */
  counts: z.object({
    pending_review: z.number().int().nonnegative(),
    approved: z.number().int().nonnegative(),
    rejected: z.number().int().nonnegative(),
  }),
});
export type OfficePaymentList = z.infer<typeof officePaymentListSchema>;

export const officePaymentDetailSchema = officePaymentSchema.extend({
  /** The student's other receipts this term, newest first (a rejected one before, say). */
  other_payments: z.array(paymentSchema),
});
export type OfficePaymentDetail = z.infer<typeof officePaymentDetailSchema>;

export const paymentParamsSchema = z.object({ payment_id: z.string().min(1) });

export const reviewPaymentBodySchema = z
  .object({
    decision: z.enum([ReviewDecision.Approve, ReviewDecision.Reject]),
    /** Shown to the student; required when rejecting. */
    reason: z.string().trim().max(REJECTION_REASON_MAX_LENGTH).nullable(),
  })
  .refine(
    (body) =>
      body.decision === ReviewDecision.Approve ||
      (body.reason ?? "").length >= REJECTION_REASON_MIN_LENGTH,
    { message: "a rejection needs a reason", path: ["reason"] },
  );
export type ReviewPaymentBody = z.infer<typeof reviewPaymentBodySchema>;

export const awaitingPaymentQuerySchema = z.object({
  identifier: z.string().trim().min(1).max(20),
});

/** A booking waiting for its payment, found by the student's university ID at the cashier. */
export const awaitingPaymentSchema = z.object({
  student: deskStudentSchema,
  subscription_id: z.string(),
  subscription_status: z.enum(SUBSCRIPTION_STATUSES),
  line: lineSummarySchema,
  stop_name: z.string(),
  price_piasters: z.number().int().positive(),
  /** When the seat is released if not paid. */
  hold_expires_at: z.iso.datetime().nullable(),
});
export type AwaitingPayment = z.infer<typeof awaitingPaymentSchema>;

export const recordOfficePaymentBodySchema = z.object({
  subscription_id: z.string().min(1),
  /** The card machine's slip number. */
  reference_number: z.string().trim().min(3).max(REFERENCE_MAX_LENGTH),
  amount_piasters: z.number().int().positive(),
  paid_on: calendarDateSchema,
  /** The card holder, often a parent. */
  payer_name: z.string().trim().min(3).max(PAYER_NAME_MAX_LENGTH),
});
export type RecordOfficePaymentBody = z.infer<typeof recordOfficePaymentBodySchema>;
