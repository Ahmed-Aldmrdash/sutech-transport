import { z } from "zod";
import { lineSummarySchema } from "@/features/lines/schema";
import { RequestKind, requestStatusSchema, studentRequestSchema } from "@/features/requests/schema";
import { SubscriptionStatus } from "@/features/subscriptions/schema";

/**
 * The offices' side of student requests (agreement, "Student: requests, notifications and
 * settings"): the Transportation office answers line changes, model permits and complaints;
 * finance answers refunds and payment complaints. An office sees a request once it reaches it
 * (a line change only after the guardian approved), opens it, and answers it with a note the
 * student reads. The server decides which requests each office sees.
 */

export const DeskAction = {
  /** Take the request: the student sees "being reviewed" (and the note, if any). */
  Open: "open",
  /** Line change, refund, model permit. */
  Approve: "approve",
  Reject: "reject",
  /** Complaints: answered, not approved. */
  Resolve: "resolve",
} as const;
export type DeskAction = (typeof DeskAction)[keyof typeof DeskAction];
const DESK_ACTIONS = [
  DeskAction.Open,
  DeskAction.Approve,
  DeskAction.Reject,
  DeskAction.Resolve,
] as const;

/** Which part of the queue: not opened yet, being worked on, or answered. */
export const DeskStage = {
  New: "new",
  InReview: "in_review",
  Closed: "closed",
} as const;
export type DeskStage = (typeof DeskStage)[keyof typeof DeskStage];
const DESK_STAGES = [DeskStage.New, DeskStage.InReview, DeskStage.Closed] as const;

export const DeskErrorCode = {
  /** Already answered or withdrawn: nothing more to do. */
  RequestClosed: "REQUEST_CLOSED",
  /** Rejecting or answering a complaint needs words for the student. */
  NoteRequired: "NOTE_REQUIRED",
  /** The action doesn't fit this kind (resolve a line change, approve a complaint). */
  ActionNotAllowed: "ACTION_NOT_ALLOWED",
  /** The new line has no free seat; reject or wait for one. */
  SeatUnavailable: "SEAT_UNAVAILABLE",
  /** The refund must be between 0 and what the student paid. */
  RefundAmountInvalid: "REFUND_AMOUNT_INVALID",
} as const;
export type DeskErrorCode = (typeof DeskErrorCode)[keyof typeof DeskErrorCode];

export const DESK_NOTE_MIN_LENGTH = 5;
export const DESK_NOTE_MAX_LENGTH = 1000;
const SEARCH_MAX_LENGTH = 60;
const PAGE_SIZE_MAX = 50;

const REQUEST_KINDS = [
  RequestKind.LineChange,
  RequestKind.Refund,
  RequestKind.Complaint,
  RequestKind.ModelPermit,
] as const;

/** The student behind a request, as the office needs them. */
const requestStudentSchema = z.object({
  student_id: z.string(),
  name: z.string(),
  identifier: z.string(),
  phone: z.string(),
  faculty: z.string().nullable(),
  level: z.number().int().nullable(),
  /** Their line today, if they have a booking. */
  line: lineSummarySchema.nullable(),
  subscription_status: z
    .enum([
      SubscriptionStatus.Reserved,
      SubscriptionStatus.PaymentReview,
      SubscriptionStatus.Active,
      SubscriptionStatus.Expired,
      SubscriptionStatus.Cancelled,
    ])
    .nullable(),
});

/** One row of an office's queue. */
export const deskRequestSummarySchema = z.object({
  request_id: z.string(),
  reference: z.string(),
  kind: z.enum(REQUEST_KINDS),
  status: requestStatusSchema,
  stage: z.enum(DESK_STAGES),
  /** One line in the request's language: "Line 4 → Line 6", "Medical refund". */
  title: z.string(),
  student: z.object({ name: z.string(), identifier: z.string() }),
  /** When it reached the office (after the guardian, for a line change). */
  received_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
  /** Who opened or answered it last; null while new. */
  handled_by_name: z.string().nullable(),
});
export type DeskRequestSummary = z.infer<typeof deskRequestSummarySchema>;

export const deskRequestListQuerySchema = z.object({
  /** One or more kinds; the server keeps only what the caller's office handles. */
  kind: z.array(z.enum(REQUEST_KINDS)).optional(),
  stage: z.enum(DESK_STAGES).optional(),
  /** University ID, part of the name, or the request number. */
  q: z.string().trim().max(SEARCH_MAX_LENGTH).optional(),
  page: z.number().int().positive().optional(),
  page_size: z.number().int().positive().max(PAGE_SIZE_MAX).optional(),
});
export type DeskRequestListQuery = z.input<typeof deskRequestListQuerySchema>;

export const deskRequestListSchema = z.object({
  /** New first (oldest first), then in review (oldest first), then closed (newest first). */
  items: z.array(deskRequestSummarySchema),
  total: z.number().int().nonnegative(),
  counts: z.object({
    new: z.number().int().nonnegative(),
    in_review: z.number().int().nonnegative(),
    closed: z.number().int().nonnegative(),
  }),
});
export type DeskRequestList = z.infer<typeof deskRequestListSchema>;

/** Ready answers the office can send as they are or edit, in the request's language. */
const suggestedRepliesSchema = z.object({
  open: z.string().nullable(),
  approve: z.string().nullable(),
  reject: z.string().nullable(),
  resolve: z.string().nullable(),
});

/** One request with everything the office needs to decide it. */
export const deskRequestSchema = z.object({
  request: studentRequestSchema,
  stage: z.enum(DESK_STAGES),
  student: requestStudentSchema,
  /** What this caller may do now; empty when the request is closed. */
  allowed_actions: z.array(z.enum(DESK_ACTIONS)),
  suggested_replies: suggestedRepliesSchema,
  /** A line change: free seats on the new line now. Null for other kinds. */
  target_seats_available: z.number().int().nonnegative().nullable(),
  handled_by_name: z.string().nullable(),
});
export type DeskRequest = z.infer<typeof deskRequestSchema>;

export const deskRequestParamsSchema = z.object({ request_id: z.string().min(1) });

export const deskActionBodySchema = z.object({
  action: z.enum(DESK_ACTIONS),
  /** What the student reads. Required to reject and to answer a complaint. */
  note: z.string().trim().max(DESK_NOTE_MAX_LENGTH).nullable(),
  /**
   * Approving a refund: the amount to pay back, in piasters. Fixed by the policy for an
   * ordinary refund (send the estimate); decided by the university for an exceptional one.
   */
  refund_piasters: z.number().int().nonnegative().nullable(),
});
export type DeskActionBody = z.infer<typeof deskActionBodySchema>;
