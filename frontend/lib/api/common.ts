import { z } from "zod";

/** Shared contract primitives (see the front end / back end agreement). */
export const Id = z.string().min(1);
export const StudentId = z.string().regex(/^\d{9}$/);
export const IsoDateTime = z.iso.datetime();
export const IsoDate = z.iso.date();
/** "HH:MM" in Cairo time, used for timetable slots that repeat every day. */
export const ClockTime = z.string().regex(/^\d{2}:\d{2}$/);
/** Whole piasters. */
export const Money = z.number().int().nonnegative();

export const Ok = z.object({ ok: z.literal(true) });

export function page<T extends z.ZodType>(item: T) {
  return z.object({ items: z.array(item), total: z.number().int().nonnegative() });
}

export const ErrorBody = z.object({ code: z.string(), message: z.string() });
