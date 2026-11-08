import { z } from "zod";
import { busTypeSchema, clockTimeSchema, lineSummarySchema } from "@/features/lines/schema";
import { receiptFileSchema } from "@/features/payments/schema";
import { calendarDateSchema } from "@/features/subscriptions/schema";

/** The things a student asks the Transportation office for. */
export const RequestKind = {
  /** The university's "طلب تغيير خط السير" form, approved by the guardian. */
  LineChange: "line_change",
  /** Cancelling the subscription and getting money back, per the refund policy. */
  Refund: "refund",
  Complaint: "complaint",
  /**
   * The university's "تصريح دخول مجسم في باص الجامعة" form: permission to bring a project model
   * onto the bus, signed by the project's doctor or TA and the Safety department.
   */
  ModelPermit: "model_permit",
} as const;
export type RequestKind = (typeof RequestKind)[keyof typeof RequestKind];
const REQUEST_KINDS = [
  RequestKind.LineChange,
  RequestKind.Refund,
  RequestKind.Complaint,
  RequestKind.ModelPermit,
] as const;

/**
 * submitted → in_review → approved | rejected (line change, refund) or resolved (complaint).
 * A line change starts one step earlier, at awaiting_guardian: the guardian approves it in the
 * app (→ submitted, to the office) or refuses it (→ rejected). The model permit, refund and
 * complaint skip that step. The student may withdraw a request until the office opens it.
 */
export const RequestStatus = {
  AwaitingGuardian: "awaiting_guardian",
  Submitted: "submitted",
  InReview: "in_review",
  Approved: "approved",
  Rejected: "rejected",
  Resolved: "resolved",
  Withdrawn: "withdrawn",
} as const;
export type RequestStatus = (typeof RequestStatus)[keyof typeof RequestStatus];
const requestStatusSchema = z.enum([
  RequestStatus.AwaitingGuardian,
  RequestStatus.Submitted,
  RequestStatus.InReview,
  RequestStatus.Approved,
  RequestStatus.Rejected,
  RequestStatus.Resolved,
  RequestStatus.Withdrawn,
]);

/** The student may withdraw a request in these statuses (before the office opens it). */
export const WITHDRAWABLE_REQUEST_STATUSES: readonly RequestStatus[] = [
  RequestStatus.AwaitingGuardian,
  RequestStatus.Submitted,
];

/** Requests not answered yet. Only one open request of each kind at a time. */
export const OPEN_REQUEST_STATUSES: readonly RequestStatus[] = [
  RequestStatus.AwaitingGuardian,
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
  /** The guardian answers only a request that is still waiting for them. */
  NotAwaitingGuardian: "NOT_AWAITING_GUARDIAN",
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

/** Why the model goes on the bus, as the permit form lists it. */
export const ModelPurpose = {
  Display: "display",
  Transport: "transport",
  Storage: "storage",
  Other: "other",
} as const;
export type ModelPurpose = (typeof ModelPurpose)[keyof typeof ModelPurpose];
export const MODEL_PURPOSES = [
  ModelPurpose.Display,
  ModelPurpose.Transport,
  ModelPurpose.Storage,
  ModelPurpose.Other,
] as const;

/**
 * The student's pledges on the permit form, in order. The app shows them and the student
 * accepts them all with one tick; the keys are under `student.requests.modelPermit.pledges`.
 */
export const MODEL_PERMIT_PLEDGES = [
  "protectModel",
  "noSeatDamage",
  "keepAisleClear",
  "noDanger",
  "noHazardousMaterials",
] as const;

export const REQUEST_TEXT_MAX_LENGTH = 1000;
/** Short form fields (material, size, destination). */
export const SHORT_TEXT_MIN_LENGTH = 2;
export const SHORT_TEXT_MAX_LENGTH = 100;
export const REQUEST_TEXT_MIN_LENGTH = 10;
export const MAX_ATTACHMENTS = 3;

/** An Egyptian mobile number: 11 digits starting 010, 011, 012 or 015. */
const egyptianMobileSchema = z.string().regex(/^01[0125]\d{8}$/);
const personNameSchema = z.string().trim().min(3).max(100);
const requestTextSchema = z
  .string()
  .trim()
  .min(REQUEST_TEXT_MIN_LENGTH)
  .max(REQUEST_TEXT_MAX_LENGTH);
const shortTextSchema = z.string().trim().min(SHORT_TEXT_MIN_LENGTH).max(SHORT_TEXT_MAX_LENGTH);

/**
 * The guardian's details, which the university's forms ask for. For a refund the student also
 * confirms the guardian agreed; a line change instead waits for the guardian to approve it in
 * the app (the guardian's account is the phone on the student's file).
 */
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

const requestStopSchema = z.object({ stop_id: z.string(), name: z.string() });

const lineChangeDetailsSchema = z.object({
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

const refundDetailsSchema = z.object({
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

const complaintDetailsSchema = z.object({
  category: z.enum(COMPLAINT_CATEGORIES),
  /** The line it happened on, if any. */
  line: lineSummarySchema.nullable(),
  happened_on: calendarDateSchema,
  description: z.string(),
  attachments: z.array(attachmentSchema),
});

const modelPermitDetailsSchema = z.object({
  /** The student's details as the permit prints them, filled from the account. */
  student_name: z.string(),
  university_id: z.string(),
  faculty: z.string().nullable(),
  /** Academic year (1 to 5); null if the university hasn't sent it. */
  level: z.number().int().nullable(),
  /** The bus: the student's own line, filled by the server from the subscription. */
  line: lineSummarySchema,
  bus_type: busTypeSchema,
  /** Filled by the Transportation office once it assigns the trip; null until then. */
  driver_name: z.string().nullable(),
  driver_phone: z.string().nullable(),
  material: z.string(),
  dimensions: z.string(),
  purpose: z.enum(MODEL_PURPOSES),
  /** Only when purpose is "other". */
  purpose_other: z.string().nullable(),
  destination: z.string(),
  entry_date: calendarDateSchema,
  entry_time: clockTimeSchema,
  exit_date: calendarDateSchema,
  exit_time: clockTimeSchema,
  /** The doctor or teaching assistant responsible for the project, who signs first. */
  supervisor_name: z.string(),
});

export const RequestActor = {
  Student: "student",
  /** The guardian, approving or refusing a line change in the app. */
  Guardian: "guardian",
  TransportOffice: "transport_office",
  Finance: "finance",
  /** The Safety department, which signs the model permit last. */
  Safety: "safety",
} as const;

/** One step in the request's history. The office's reply to the student is in `note`. */
export const requestEventSchema = z.object({
  status: requestStatusSchema,
  at: z.iso.datetime(),
  by: z.enum([
    RequestActor.Student,
    RequestActor.Guardian,
    RequestActor.TransportOffice,
    RequestActor.Finance,
    RequestActor.Safety,
  ]),
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
  /** Oldest first; the first event is the student sending it (submitted or awaiting_guardian). */
  timeline: z.array(requestEventSchema).min(1),
});

export const studentRequestSchema = z.discriminatedUnion("kind", [
  requestBase.extend({
    kind: z.literal(RequestKind.LineChange),
    details: lineChangeDetailsSchema,
  }),
  requestBase.extend({ kind: z.literal(RequestKind.Refund), details: refundDetailsSchema }),
  requestBase.extend({ kind: z.literal(RequestKind.Complaint), details: complaintDetailsSchema }),
  requestBase.extend({
    kind: z.literal(RequestKind.ModelPermit),
    details: modelPermitDetailsSchema,
  }),
]);
export type StudentRequest = z.infer<typeof studentRequestSchema>;
export type LineChangeRequest = Extract<StudentRequest, { kind: "line_change" }>;

export const listMyRequestsQuerySchema = z.object({
  kind: z.enum(REQUEST_KINDS).optional(),
});

export const requestParamsSchema = z.object({ request_id: z.string().min(1) });

export const createLineChangeBodySchema = guardianSchema
  .omit({ guardian_consent: true })
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

/** "YYYY-MM-DD" + "HH:MM" compare correctly as plain strings. */
const momentOf = (date: string, time: string) => `${date}T${time}`;

export const createModelPermitBodySchema = z
  .object({
    material: shortTextSchema,
    dimensions: shortTextSchema,
    purpose: z.enum(MODEL_PURPOSES),
    purpose_other: shortTextSchema.nullable(),
    destination: shortTextSchema,
    entry_date: calendarDateSchema,
    entry_time: clockTimeSchema,
    exit_date: calendarDateSchema,
    exit_time: clockTimeSchema,
    supervisor_name: personNameSchema,
    /** The student accepts the liability declaration (every pledge on the form). */
    declaration_accepted: z.literal(true),
  })
  .refine((body) => (body.purpose === ModelPurpose.Other) === (body.purpose_other !== null), {
    message: "purpose_other is required when purpose is other and must be null otherwise",
    path: ["purpose_other"],
  })
  .refine(
    (body) => momentOf(body.exit_date, body.exit_time) > momentOf(body.entry_date, body.entry_time),
    { message: "the exit must be after the entry", path: ["exit_time"] },
  );
export type CreateModelPermitBody = z.infer<typeof createModelPermitBodySchema>;

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

/** A child's line change, as the guardian sees it on the approvals page. */
export const guardianApprovalSchema = z.object({
  student_id: z.string(),
  student_name: z.string(),
  request: studentRequestSchema,
  /**
   * Until when the guardian may change their answer (ISO, UTC): 10 minutes after answering,
   * and only while the office hasn't opened the request. Null: the answer can't change now.
   */
  can_change_until: z.string().nullable(),
});
export type GuardianApproval = z.infer<typeof guardianApprovalSchema>;
export const guardianApprovalListSchema = z.object({ approvals: z.array(guardianApprovalSchema) });

/** Why the guardian refused, shown to the student; optional. */
export const guardianDecisionBodySchema = z.object({
  note: z.string().trim().max(REQUEST_TEXT_MAX_LENGTH).nullable(),
});
export type GuardianDecisionBody = z.infer<typeof guardianDecisionBodySchema>;
