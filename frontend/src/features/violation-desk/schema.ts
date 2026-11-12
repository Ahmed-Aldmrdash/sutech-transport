import { z } from "zod";
import { lineSummarySchema } from "@/features/lines/schema";
import {
  CONDUCT_RULES,
  VIOLATION_OUTCOMES,
  ViolationStatus,
  violationSchema,
} from "@/features/violations/schema";
import { Role } from "@/lib/auth/roles";

/**
 * The offices' side of bus violations (agreement, roles table): the crew records a breach of
 * the Code of Conduct with a photo; Student Affairs opens it, looks into it and closes it with
 * a decision. The Transportation office follows the same list without acting on it.
 */

export const ViolationDeskAction = {
  /** Student Affairs takes it: the crew sees "under review". */
  Open: "open",
  /** Closes it with an outcome and a note for the file. */
  Close: "close",
} as const;
export type ViolationDeskAction = (typeof ViolationDeskAction)[keyof typeof ViolationDeskAction];
const DESK_ACTIONS = [ViolationDeskAction.Open, ViolationDeskAction.Close] as const;

export const ViolationDeskErrorCode = {
  /** Already closed: the decision stands. */
  ViolationClosed: "VIOLATION_CLOSED",
  /** Closing needs an outcome and a note. */
  DecisionRequired: "DECISION_REQUIRED",
} as const;

export const VIOLATION_NOTE_MIN_LENGTH = 5;
export const VIOLATION_NOTE_MAX_LENGTH = 500;
const SEARCH_MAX_LENGTH = 60;
const PAGE_SIZE_MAX = 50;

const VIOLATION_STATUSES = [
  ViolationStatus.Submitted,
  ViolationStatus.UnderReview,
  ViolationStatus.Closed,
] as const;

export const deskViolationSchema = violationSchema.extend({
  /** The student's university ID is in `student.identifier`. */
  reported_by: z.object({
    name: z.string(),
    role: z.enum([Role.Driver, Role.Supervisor]),
  }),
  line: lineSummarySchema.nullable(),
  /** A short-lived link to the photo; null in the demo, which doesn't keep photos. */
  photo_url: z.url().nullable(),
  opened_by_name: z.string().nullable(),
  decision: z
    .object({
      outcome: z.enum(VIOLATION_OUTCOMES),
      note: z.string(),
      by_name: z.string(),
      at: z.iso.datetime(),
    })
    .nullable(),
  /** What this caller may do now: Student Affairs acts, Transportation only reads. */
  allowed_actions: z.array(z.enum(DESK_ACTIONS)),
});
export type DeskViolation = z.infer<typeof deskViolationSchema>;

export const deskViolationListQuerySchema = z.object({
  status: z.enum(VIOLATION_STATUSES).optional(),
  rule: z.enum(CONDUCT_RULES).optional(),
  /** University ID or part of the student's name. */
  q: z.string().trim().max(SEARCH_MAX_LENGTH).optional(),
  page: z.number().int().positive().optional(),
  page_size: z.number().int().positive().max(PAGE_SIZE_MAX).optional(),
});
export type DeskViolationListQuery = z.input<typeof deskViolationListQuerySchema>;

export const deskViolationListSchema = z.object({
  /** New first (oldest first), then under review, then closed (newest first). */
  items: z.array(deskViolationSchema),
  total: z.number().int().nonnegative(),
  counts: z.object({
    submitted: z.number().int().nonnegative(),
    under_review: z.number().int().nonnegative(),
    closed: z.number().int().nonnegative(),
  }),
});
export type DeskViolationList = z.infer<typeof deskViolationListSchema>;

export const violationParamsSchema = z.object({ violation_id: z.string().min(1) });

export const violationDeskActionBodySchema = z
  .object({
    action: z.enum(DESK_ACTIONS),
    outcome: z.enum(VIOLATION_OUTCOMES).nullable(),
    note: z.string().trim().max(VIOLATION_NOTE_MAX_LENGTH).nullable(),
  })
  .refine(
    (body) =>
      body.action === ViolationDeskAction.Open ||
      (body.outcome !== null && (body.note ?? "").length >= VIOLATION_NOTE_MIN_LENGTH),
    { message: "closing needs an outcome and a note", path: ["note"] },
  );
export type ViolationDeskActionBody = z.infer<typeof violationDeskActionBodySchema>;
