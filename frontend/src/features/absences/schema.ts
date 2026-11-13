import { z } from "zod";
import { isoDateTime } from "@/lib/api/iso-datetime";
import { calendarDateSchema } from "@/features/subscriptions/schema";

/** Why the student won't ride. Only shown to the office and the driver as a hint. */
export const AbsenceReason = {
  Sick: "sick",
  NoLectures: "no_lectures",
  Personal: "personal",
  Other: "other",
} as const;
export type AbsenceReason = (typeof AbsenceReason)[keyof typeof AbsenceReason];
export const ABSENCE_REASONS = [
  AbsenceReason.Sick,
  AbsenceReason.NoLectures,
  AbsenceReason.Personal,
  AbsenceReason.Other,
] as const;

export const AbsenceErrorCode = {
  /** "Not going" is for active subscribers only. */
  NoActiveSubscription: "NO_ACTIVE_SUBSCRIPTION",
  /** The day is not one of the next reportable service days (Sunday to Thursday, 7 days ahead). */
  DateNotReportable: "DATE_NOT_REPORTABLE",
  /** The bus already left the first stop of the line that day. */
  AbsenceCutoffPassed: "ABSENCE_CUTOFF_PASSED",
  AlreadyReported: "ALREADY_REPORTED",
} as const;

/** How far ahead a student may say they won't ride. */
export const ABSENCE_DAYS_AHEAD = 7;
export const ABSENCE_NOTE_MAX_LENGTH = 200;

/** One day the student said they won't ride. Covers both trips of that day. */
export const absenceSchema = z.object({
  absence_id: z.string(),
  service_date: calendarDateSchema,
  reason: z.enum(ABSENCE_REASONS),
  note: z.string().nullable(),
  created_at: isoDateTime(),
  /** The bus leaves the line's first stop then; after it the report can't be taken back. */
  cutoff_at: isoDateTime(),
});
export type Absence = z.infer<typeof absenceSchema>;

/** A service day the student can still report, with its cutoff. */
export const reportableDaySchema = z.object({
  service_date: calendarDateSchema,
  cutoff_at: isoDateTime(),
});
export type ReportableDay = z.infer<typeof reportableDaySchema>;

export const myAbsencesSchema = z.object({
  /** Reported days from today on, soonest first. Past days are in "My trips". */
  upcoming: z.array(absenceSchema),
  /** The next service days (today included until its cutoff) not reported yet. */
  reportable_days: z.array(reportableDaySchema),
});
export type MyAbsences = z.infer<typeof myAbsencesSchema>;

export const createAbsenceBodySchema = z.object({
  service_date: calendarDateSchema,
  reason: z.enum(ABSENCE_REASONS),
  note: z.string().trim().max(ABSENCE_NOTE_MAX_LENGTH).nullable(),
});
export type CreateAbsenceBody = z.infer<typeof createAbsenceBodySchema>;

export const absenceParamsSchema = z.object({ absence_id: z.string().min(1) });
