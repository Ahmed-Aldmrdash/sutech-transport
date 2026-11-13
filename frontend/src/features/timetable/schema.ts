import { z } from "zod";
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
  changed_at: z.iso.datetime().nullable(),
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

export const TimetableErrorCode = { LineNotFound: "LINE_NOT_FOUND" } as const;
export type TimetableErrorCode = (typeof TimetableErrorCode)[keyof typeof TimetableErrorCode];
