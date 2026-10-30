import { z } from "zod";
import { Id, IsoDate, IsoDateTime } from "@/lib/api/common";

export const AttendanceEventType = {
  Skipped: "skipped",
  Unskipped: "unskipped",
  Boarded: "boarded",
  Arrived: "arrived",
  CheckedOut: "checked_out",
  Absent: "absent",
  ReturnBoarded: "return_boarded",
  ReturnArrived: "return_arrived",
} as const;
export type AttendanceEventType = (typeof AttendanceEventType)[keyof typeof AttendanceEventType];

export const AttendanceEvent = z.object({
  type: z.enum(Object.values(AttendanceEventType) as [AttendanceEventType, ...AttendanceEventType[]]),
  at: IsoDateTime,
  /** Check-out reason, or the stop name for a boarding. */
  detail: z.string().nullable(),
  recorded_by: z.string().nullable(),
});
export type AttendanceEvent = z.infer<typeof AttendanceEvent>;

export const DayRecord = z.object({
  student_id: z.string(),
  student_name: z.string(),
  date: IsoDate,
  skipped: z.boolean(),
  events: z.array(AttendanceEvent),
});
export type DayRecord = z.infer<typeof DayRecord>;

export const SkipDay = z.object({ date: IsoDate });

export const AttendanceSummary = z.object({
  date: IsoDate,
  line_id: Id.nullable(),
  rows: z.array(
    z.object({
      student_id: z.string(),
      student_name: z.string(),
      line_id: Id,
      line_name: z.string(),
      status: z.enum(["arrived", "on_bus", "checked_out", "absent", "skipped", "waiting"]),
      at: IsoDateTime.nullable(),
      detail: z.string().nullable(),
    }),
  ),
  totals: z.object({
    arrived: z.number().int(),
    on_bus: z.number().int(),
    checked_out: z.number().int(),
    absent: z.number().int(),
    skipped: z.number().int(),
    waiting: z.number().int(),
  }),
});
export type AttendanceSummary = z.infer<typeof AttendanceSummary>;
