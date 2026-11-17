import { z } from "zod";
import { isoDateTime } from "@/lib/api/iso-datetime";
import { calendarDateSchema } from "@/features/subscriptions/schema";

/**
 * What the office can do about a student's behaviour, beyond a single bus violation:
 * warning: on file, the student and guardian are told · suspension: may not ride from
 * starts_on to ends_on (the crew's scan refuses them) · ban: may not ride or book until the
 * office lifts it. A suspension or ban can be lifted early; a warning stays on file.
 */
export const DisciplineAction = {
  Warning: "warning",
  Suspension: "suspension",
  Ban: "ban",
} as const;
export type DisciplineAction = (typeof DisciplineAction)[keyof typeof DisciplineAction];
const DISCIPLINE_ACTIONS = Object.values(DisciplineAction) as [
  DisciplineAction,
  ...DisciplineAction[],
];

/** The student's standing today, the worst that applies. */
export const Standing = {
  Good: "good",
  Warned: "warned",
  Suspended: "suspended",
  Banned: "banned",
} as const;
export type Standing = (typeof Standing)[keyof typeof Standing];
export const STANDINGS = Object.values(Standing) as [Standing, ...Standing[]];

export const DisciplineErrorCode = {
  /** Banned students can't book a seat or ride. */
  StudentBanned: "STUDENT_BANNED",
  /** Suspended today: the crew can't board them. */
  StudentSuspended: "STUDENT_SUSPENDED",
  /** A suspension needs an end day from tomorrow on, at most 90 days ahead. */
  InvalidSuspension: "INVALID_SUSPENSION",
  /** Already banned: lift the ban first. */
  AlreadyBanned: "ALREADY_BANNED",
  /** Warnings stay on file; only a suspension or a ban is lifted. */
  NotLiftable: "NOT_LIFTABLE",
  AlreadyLifted: "ALREADY_LIFTED",
  StudentNotFound: "STUDENT_NOT_FOUND",
} as const;
export type DisciplineErrorCode = (typeof DisciplineErrorCode)[keyof typeof DisciplineErrorCode];

export const MAX_SUSPENSION_DAYS = 90;
export const DISCIPLINE_REASON_MIN = 5;
export const DISCIPLINE_REASON_MAX = 300;

export const disciplineRecordSchema = z.object({
  record_id: z.string(),
  action: z.enum(DISCIPLINE_ACTIONS),
  /** Shown to the student and guardian. */
  reason: z.string(),
  /** The first day it applies (Cairo). */
  starts_on: calendarDateSchema,
  /** Suspension: the last day. Warning and ban: null. */
  ends_on: calendarDateSchema.nullable(),
  /** Still in force today (a warning is always "in force" for the term). */
  in_force: z.boolean(),
  by_name: z.string(),
  created_at: isoDateTime(),
  lifted_at: isoDateTime().nullable(),
  lifted_by_name: z.string().nullable(),
  lift_note: z.string().nullable(),
});
export type DisciplineRecord = z.infer<typeof disciplineRecordSchema>;

export const studentStandingSchema = z.object({
  standing: z.enum(STANDINGS),
  /** Warnings on file this term. */
  warnings: z.number().int().nonnegative(),
  /** While suspended: the last day of the suspension. */
  suspended_until: calendarDateSchema.nullable(),
  /** Newest first. */
  records: z.array(disciplineRecordSchema),
});
export type StudentStanding = z.infer<typeof studentStandingSchema>;

export const studentParamsSchema = z.object({ student_id: z.string().min(1) });
export const recordParamsSchema = z.object({ record_id: z.string().min(1) });

export const createDisciplineBodySchema = z.object({
  action: z.enum(DISCIPLINE_ACTIONS),
  reason: z.string().trim().min(DISCIPLINE_REASON_MIN).max(DISCIPLINE_REASON_MAX),
  /** Suspension only: the last day (from tomorrow, at most 90 days ahead). */
  ends_on: calendarDateSchema.nullable(),
});
export type CreateDisciplineBody = z.infer<typeof createDisciplineBodySchema>;

export const liftDisciplineBodySchema = z.object({
  note: z.string().trim().min(DISCIPLINE_REASON_MIN).max(DISCIPLINE_REASON_MAX),
});
export type LiftDisciplineBody = z.infer<typeof liftDisciplineBodySchema>;
