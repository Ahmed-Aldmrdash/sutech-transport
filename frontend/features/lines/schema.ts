import { z } from "zod";
import { ClockTime, Id, Money } from "@/lib/api/common";

export const Operator = z.enum(["university", "bus_company"]);

export const LineStop = z.object({
  id: Id,
  name: z.string(),
  /** Pick-up time on the outbound trip, Cairo time. */
  time: ClockTime,
  active: z.boolean(),
  /** The last stop (the university gate). Students can't book it. */
  is_destination: z.boolean(),
  lat: z.number(),
  lng: z.number(),
});
export type LineStop = z.infer<typeof LineStop>;

export const Line = z.object({
  id: Id,
  name: z.string(),
  price: Money,
  capacity: z.number().int().positive(),
  booked: z.number().int().nonnegative(),
  seats_left: z.number().int().nonnegative(),
  bus_id: Id.nullable(),
  bus_plate: z.string().nullable(),
  bus_type: z.string().nullable(),
  driver_name: z.string().nullable(),
  operator: Operator,
  stops: z.array(LineStop),
});
export type Line = z.infer<typeof Line>;

export const LineList = z.object({ items: z.array(Line), total: z.number().int() });
