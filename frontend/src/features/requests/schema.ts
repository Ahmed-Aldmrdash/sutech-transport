import { z } from "zod";
import { lineSummarySchema } from "@/features/lines/schema";
import { receiptFileSchema } from "@/features/payments/schema";
import { calendarDateSchema } from "@/features/subscriptions/schema";

/** The three things a student asks the Transportation office for. */
export const RequestKind = {
  /** The university's "طلب تغيير خط السير" form, approved by the guardian. */
  LineChange: "line_change",
  /** Cancelling the subscription and getting money back, per the refund policy. */
  Refund: "refund",
  Complaint: "complaint",
} as const;
export type RequestKind = (typeof RequestKind)[keyof typeof RequestKind];
export const REQUEST_KINDS = [RequestKind.LineChange, RequestKind.Refund, RequestKind.Complaint];

/**
 * submitted → in_review → approved | rejected (line change, refund) or resolved (complaint).
 * The student may withdraw a request only while it is still submitted.
 */
export const RequestStatus = {
  Submitted: "submitted",
  InReview: "in_review",
  Approved: "approved",
  Rejected: "rejected",
  Resolved: "resolved",
  Withdrawn: "withdrawn",
} as const;
export type RequestStatus = (typeof RequestStatus)[keyof typeof RequestStatus];
const requestStatusSchema = z.enum([
  RequestStatus.Submitted,
  RequestStatus.InReview,
  RequestStatus.Approved,
  RequestStatus.Rejected,
  RequestStatus.Resolved,
  RequestStatus.Withdrawn,
]);

/** Requests still waiting for the office. Only one open request of each kind at a time. */
export const OPEN_REQUEST_STATUSES: readonly RequestStatus[] = [
  RequestStatus.Submitted,
  RequestStatus.InReview,
];

export const RequestErrorCode = {
  /**
   * Line changes, refunds and complaints about the trip need an active (paid) subscription.
   * Payment complaints only need a booking.
   */
  NoActiveSubscription: "NO_ACTIVE_SUBSCRIPTION",
  /** A payment complaint from a student who never booked. */
  NoSubscription: "NO_SUBSCRIPTION",
  /** There is already an open request of this kind. */
  RequestAlreadyOpen: "REQUEST_ALREADY_OPEN",
  SameLine: "SAME_LINE",
  InvalidDates: "INVALID_DATES",
  /** Ordinary refunds are closed for the term (100% deduction); only exceptional cases remain. */
  RefundWindowClosed: "REFUND_WINDOW_CLOSED",
  /** Exceptional refund reasons need at least one supporting document. */
  DocumentsRequired: "DOCUMENTS_REQUIRED",
  NotWithdrawable: "NOT_WITHDRAWABLE",
} as const;

export const LineChangeDuration = {
  Permanent: "permanent",
  Temporary: "temporary",
} as const;
export type LineChangeDuration = (typeof LineChangeDuration)[keyof typeof LineChangeDuration];

/**
 * Refund reasons from the refund policy: an ordinary refund follows the dated deduction table;
 * the other three are decided case by case by the university, with documents.
 */
export const RefundReason = {
  Standard: "standard",
  /** Health conditions, disability or injury (medical report). */
  Medical: "medical",
  /** A death in the family (certificate). */
  Bereavement: "bereavement",
  /** Moving to another university (transfer letter). */
  Transfer: "transfer",
} as const;
export type RefundReason = (typeof RefundReason)[keyof typeof RefundReason];
export const REFUND_REASONS = [
  RefundReason.Standard,
  RefundReason.Medical,
  RefundReason.Bereavement,
  RefundReason.Transfer,
] as const;
export const EXCEPTIONAL_REFUND_REASONS: readonly RefundReason[] = [
  RefundReason.Medical,
  RefundReason.Bereavement,
  RefundReason.Transfer,
];

export const ComplaintCategory = {
  DriverBehaviour: "driver_behaviour",
  Delay: "delay",
  BusCondition: "bus_condition",
  Crowding: "crowding",
  Safety: "safety",
  /** A booking or receipt problem: the only kind allowed before the subscription is active. */
  Payment: "payment",
  Other: "other",
} as const;
export type ComplaintCategory = (typeof ComplaintCategory)[keyof typeof ComplaintCategory];
export const COMPLAINT_CATEGORIES = [
  ComplaintCategory.DriverBehaviour,
  ComplaintCategory.Delay,
  ComplaintCategory.BusCondition,
  ComplaintCategory.Crowding,
  ComplaintCategory.Safety,
  ComplaintCategory.Payment,
  ComplaintCategory.Other,
] as const;

export const REQUEST_TEXT_MAX_LENGTH = 1000;
export const REQUEST_TEXT_MIN_LENGTH = 10;
export const MAX_ATTACHMENTS = 3;

/** An Egyptian mobile number: 11 digits starting 010, 011, 012 or 015. */
export const egyptianMobileSchema = z.string().regex(/^01[0125]\d{8}$/);
const personNameSchema = z.string().trim().min(3).max(100);
const requestTextSchema = z
  .string()
  .trim()
  .min(REQUEST_TEXT_MIN_LENGTH)
  .max(REQUEST_TEXT_MAX_LENGTH);

/** The guardian's approval, which the university's forms ask for (line change and refund). */
const guardianSchema = z.object({
  guardian_name: personNameSchema,
  guardian_phone: egyptianMobileSchema,
  /** The student confirms the guardian agreed. The office may call to check. */
  guardian_consent: z.literal(true),
});

export const attachmentSchema = z.object({
  attachment_id: z.string(),
  file_name: z.string(),
  content_type: z.string(),
  size_bytes: z.number().int().nonnegative(),
});
export type Attachment = z.infer<typeof attachmentSchema>;

export const requestStopSchema = z.object({ stop_id: z.string(), name: z.string() });

export const lineChangeDetailsSchema = z.object({
  from_line: lineSummarySchema,
  to_line: lineSummarySchema,
  /** The pickup or drop-off point on the new line. */
  to_stop: requestStopSchema,
  duration: z.enum([LineChangeDuration.Permanent, LineChangeDuration.Temporary]),
  starts_on: calendarDateSchema,
  /** Only for a temporary change. */
  ends_on: calendarDateSchema.nullable(),
  reason: z.string(),
  student_phone: z.string(),
  guardian_name: z.string(),
  guardian_phone: z.string(),
});

export const refundDetailsSchema = z.object({
  subscription_id: z.string(),
  reason: z.enum(REFUND_REASONS),
  explanation: z.string(),
  paid_piasters: z.number().int().nonnegative(),
  /** The deduction that applied on the day the request was sent. */
  deduction_percent: z.number().int().min(0).max(100),
  /**
   * paid × (100 − deduction) for an ordinary refund; null for an exceptional case, which the
   * university decides.
   */
  estimated_refund_piasters: z.number().int().nonnegative().nullable(),
  guardian_name: z.string(),
  guardian_phone: z.string(),
  attachments: z.array(attachmentSchema),
});

export const complaintDetailsSchema = z.object({
  category: z.enum(COMPLAINT_CATEGORIES),
  /** The line it happened on, if any. */
  line: lineSummarySchema.nullable(),
  happened_on: calendarDateSchema,
  description: z.string(),
  attachments: z.array(attachmentSchema),
});

export const RequestActor = {
  Student: "student",
  TransportOffice: "transport_office",
  Finance: "finance",
} as const;

/** One step in the request's history. The office's reply to the student is in `note`. */
export const requestEventSchema = z.object({
  status: requestStatusSchema,
  at: z.iso.datetime(),
  by: z.enum([RequestActor.Student, RequestActor.TransportOffice, RequestActor.Finance]),
  /** In the request's language; null when there is nothing to say. */
  note: z.string().nullable(),
});
export type RequestEvent = z.infer<typeof requestEventSchema>;

const requestBase = z.object({
  request_id: z.string(),
  /** Short number to quote at the office, e.g. "REQ-2026-0042". */
  reference: z.string(),
  status: requestStatusSchema,
  submitted_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
  /** Oldest first; the first event is always "submitted". */
  timeline: z.array(requestEventSchema).min(1),
});

export const studentRequestSchema = z.discriminatedUnion("kind", [
  requestBase.extend({
    kind: z.literal(RequestKind.LineChange),
    details: lineChangeDetailsSchema,
  }),
  requestBase.extend({ kind: z.literal(RequestKind.Refund), details: refundDetailsSchema }),
  requestBase.extend({ kind: z.literal(RequestKind.Complaint), details: complaintDetailsSchema }),
]);
export type StudentRequest = z.infer<typeof studentRequestSchema>;
export type LineChangeRequest = Extract<StudentRequest, { kind: "line_change" }>;
export type RefundRequest = Extract<StudentRequest, { kind: "refund" }>;
export type ComplaintRequest = Extract<StudentRequest, { kind: "complaint" }>;

export const listMyRequestsQuerySchema = z.object({
  kind: z.enum([RequestKind.LineChange, RequestKind.Refund, RequestKind.Complaint]).optional(),
});

export const requestParamsSchema = z.object({ request_id: z.string().min(1) });

export const createLineChangeBodySchema = guardianSchema
  .extend({
    to_line_id: z.string().min(1),
    to_stop_id: z.string().min(1),
    duration: z.enum([LineChangeDuration.Permanent, LineChangeDuration.Temporary]),
    starts_on: calendarDateSchema,
    ends_on: calendarDateSchema.nullable(),
    reason: requestTextSchema,
    student_phone: egyptianMobileSchema,
  })
  .refine((body) => (body.duration === LineChangeDuration.Temporary) === (body.ends_on !== null), {
    message: "ends_on is required for a temporary change and must be null for a permanent one",
    path: ["ends_on"],
  });
export type CreateLineChangeBody = z.infer<typeof createLineChangeBodySchema>;

export const createRefundBodySchema = guardianSchema.extend({
  subscription_id: z.string().min(1),
  reason: z.enum(REFUND_REASONS),
  explanation: requestTextSchema,
  /** Medical report, death certificate or transfer letter. Required for exceptional reasons. */
  documents: z.array(receiptFileSchema).max(MAX_ATTACHMENTS),
});
export type CreateRefundBody = z.infer<typeof createRefundBodySchema>;

export const createComplaintBodySchema = z.object({
  category: z.enum(COMPLAINT_CATEGORIES),
  line_id: z.string().min(1).nullable(),
  happened_on: calendarDateSchema,
  description: requestTextSchema,
  /** Photos or a PDF, optional. */
  attachments: z.array(receiptFileSchema).max(MAX_ATTACHMENTS),
});
export type CreateComplaintBody = z.infer<typeof createComplaintBodySchema>;

/** One row of the refund table: from `from` to `to` (inclusive), `deduction_percent` is kept. */
export const refundWindowSchema = z.object({
  from: calendarDateSchema,
  /** null: until the end of the term. */
  to: calendarDateSchema.nullable(),
  deduction_percent: z.number().int().min(0).max(100),
});
export type RefundWindow = z.infer<typeof refundWindowSchema>;

/** The term's refund policy and what it means for this student today. */
export const refundPolicySchema = z.object({
  term_name: z.string(),
  windows: z.array(refundWindowSchema),
  /** Today's deduction (Cairo date). 100 means ordinary refunds are closed. */
  today_deduction_percent: z.number().int().min(0).max(100),
  /** The approved amount the student paid this term, or null if nothing is paid. */
  paid_piasters: z.number().int().nonnegative().nullable(),
  subscription_id: z.string().nullable(),
  /** Refunds are paid by a cheque in the guardian's name within this many days. */
  payout_days: z.number().int().positive(),
  /** How long the office takes to process a request. */
  processing_days: z.number().int().positive(),
});
export type RefundPolicy = z.infer<typeof refundPolicySchema>;
