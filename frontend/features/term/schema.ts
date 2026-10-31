import { z } from "zod";
import { IsoDate } from "@/lib/api/common";

export const BookingState = z.enum(["open", "closed"]);

export const RefundTier = z.object({
  /** First and last teaching week of the tier. 0 = before the term starts; null = no upper bound. */
  from_week: z.number().int().nonnegative(),
  to_week: z.number().int().nonnegative().nullable(),
  deduction_percent: z.number().int().min(0).max(100),
});
export type RefundTier = z.infer<typeof RefundTier>;

export const Term = z.object({
  current: z.object({
    name: z.string(),
    booking: BookingState,
    booking_closes_on: IsoDate,
    /** Current teaching week (0 = the term hasn't started). */
    week: z.number().int().nonnegative(),
  }),
  next: z
    .object({
      name: z.string(),
      booking_opens_on: IsoDate,
      booking_closes_on: IsoDate,
      starts_on: IsoDate,
    })
    .nullable(),
  refund_policy: z.array(RefundTier),
});
export type Term = z.infer<typeof Term>;

export const UpdateBooking = z.object({ booking: BookingState });
export const UpdateNextTerm = z.object({
  name: z.string().trim().min(3).max(80),
  booking_opens_on: IsoDate,
  booking_closes_on: IsoDate,
  starts_on: IsoDate,
  announce: z.boolean(),
});
