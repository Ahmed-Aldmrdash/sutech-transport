import { z } from "zod";
import { isoDateTime } from "@/lib/api/iso-datetime";
import { arrivalWindowSchema, clockTimeSchema, lineSummarySchema } from "@/features/lines/schema";

/** One line's day on the timetable: first pickup, campus arrival, and when it leaves campus. */
export const timetableRowSchema = z.object({
  line: lineSummarySchema,
  stop_count: z.number().int().nonnegative(),
  first_pickup_time: clockTimeSchema.nullable(),
  campus_arrival: arrivalWindowSchema,
  return_departure_time: clockTimeSchema,
  /** Who last changed this line's return time, and when; null while it is the default. */
  changed_by_name: z.string().nullable(),
  changed_at: isoDateTime().nullable(),
});
export type TimetableRow = z.infer<typeof timetableRowSchema>;

export const timetableSchema = z.object({
  items: z.array(timetableRowSchema),
  /** The return time every line has unless the office set another one. */
  default_return_time: clockTimeSchema,
});
export type Timetable = z.infer<typeof timetableSchema>;

/** A new return time for some lines, or for every line when `line_ids` is empty. */
export const returnTimeChangeSchema = z.object({
  line_ids: z.array(z.string()),
  return_departure_time: clockTimeSchema,
});
export type ReturnTimeChange = z.infer<typeof returnTimeChangeSchema>;

/**
 * The return times the office may set, "HH:MM" Egypt time. Buses leave campus at 16:30 unless
 * the office sets another time; it may not be before noon (the buses reach campus at 08:30 for
 * the day's lectures) or after 8 PM.
 */
export const RETURN_TIME_EARLIEST = "12:00";
export const RETURN_TIME_LATEST = "20:00";

/** "HH:MM" strings compare in time order, so the range check is a string comparison. */
export function isReturnTimeAllowed(clock: string): boolean {
  return clock >= RETURN_TIME_EARLIEST && clock <= RETURN_TIME_LATEST;
}

export const TimetableErrorCode = {
  LineNotFound: "LINE_NOT_FOUND",
  /** The time is outside RETURN_TIME_EARLIEST to RETURN_TIME_LATEST. */
  ReturnTimeOutOfRange: "RETURN_TIME_OUT_OF_RANGE",
} as const;
export type TimetableErrorCode = (typeof TimetableErrorCode)[keyof typeof TimetableErrorCode];
