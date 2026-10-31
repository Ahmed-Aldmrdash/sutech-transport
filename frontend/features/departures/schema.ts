import { z } from "zod";
import { ClockTime, Id } from "@/lib/api/common";

/** Extra return trips (e.g. after a lecture ends early). */
export const Departure = z.object({
  id: Id,
  time: ClockTime,
  line_id: Id.nullable(),
  line_name: z.string(),
  capacity: z.number().int().positive(),
  booked: z.number().int().nonnegative(),
  reason: z.string(),
  status: z.enum(["open", "cancelled"]),
  /** Whether the caller (a student) joined it. */
  joined: z.boolean(),
  lecture_id: Id.nullable(),
});
export type Departure = z.infer<typeof Departure>;

export const NewDeparture = z.object({
  time: ClockTime,
  line_id: Id.nullable(),
  bus_id: Id,
  reason: z.string().trim().min(3).max(200),
  lecture_id: Id.nullable(),
});

export const Lecture = z.object({
  id: Id,
  group: z.string(),
  ends_at: ClockTime,
  students: z.number().int().nonnegative(),
  note: z.string().nullable(),
});
export type Lecture = z.infer<typeof Lecture>;
