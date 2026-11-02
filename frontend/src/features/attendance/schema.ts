import { z } from "zod";
import { lineSummarySchema } from "@/features/lines/schema";
import { calendarDateSchema } from "@/features/subscriptions/schema";
import { TripDirection } from "@/features/trips/schema";

/**
 * What happened on one trip, from the scans on the bus.
 * rode: scanned on board · absent: not scanned and no "not going" report ·
 * not_going: the student reported the day off · checked_out: left the bus mid-trip (reason).
 */
export const TripOutcome = {
  Rode: "rode",
  Absent: "absent",
  NotGoing: "not_going",
  CheckedOut: "checked_out",
} as const;
export type TripOutcome = (typeof TripOutcome)[keyof typeof TripOutcome];
export const TRIP_OUTCOMES = [
  TripOutcome.Rode,
  TripOutcome.Absent,
  TripOutcome.NotGoing,
  TripOutcome.CheckedOut,
] as const;

export const tripRecordSchema = z.object({
  trip_id: z.string(),
  service_date: calendarDateSchema,
  direction: z.enum([TripDirection.Outbound, TripDirection.Return]),
  line: lineSummarySchema,
  stop_name: z.string(),
  outcome: z.enum(TRIP_OUTCOMES),
  /** Scan times; null when it didn't happen. */
  boarded_at: z.iso.datetime().nullable(),
  arrived_at: z.iso.datetime().nullable(),
  checked_out_at: z.iso.datetime().nullable(),
  /** In the request's language, e.g. "Felt unwell". */
  checkout_reason: z.string().nullable(),
});
export type TripRecord = z.infer<typeof tripRecordSchema>;

export const ATTENDANCE_MAX_PAGE_SIZE = 50;

export const attendanceQuerySchema = z.object({
  outcome: z.enum(TRIP_OUTCOMES).optional(),
  page: z.number().int().positive().optional(),
  page_size: z.number().int().positive().max(ATTENDANCE_MAX_PAGE_SIZE).optional(),
});

export const attendanceSummarySchema = z.object({
  rode: z.number().int().nonnegative(),
  absent: z.number().int().nonnegative(),
  not_going: z.number().int().nonnegative(),
  checked_out: z.number().int().nonnegative(),
});
export type AttendanceSummary = z.infer<typeof attendanceSummarySchema>;

export const myAttendanceSchema = z.object({
  /** Newest first. */
  items: z.array(tripRecordSchema),
  /** Count of items matching the filter. */
  total: z.number().int().nonnegative(),
  /** This term, all outcomes, whatever the filter. */
  summary: attendanceSummarySchema,
});
export type MyAttendance = z.infer<typeof myAttendanceSchema>;
