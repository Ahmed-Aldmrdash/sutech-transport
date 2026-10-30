import { z } from "zod";
import { ClockTime, Id, IsoDateTime } from "@/lib/api/common";

export const TripDirection = { Outbound: "outbound", Return: "return" } as const;
export type TripDirection = (typeof TripDirection)[keyof typeof TripDirection];

export const TripState = { NotStarted: "not_started", InProgress: "in_progress", Ended: "ended" } as const;
export type TripState = (typeof TripState)[keyof typeof TripState];

export const BusPosition = z.object({
  lat: z.number(),
  lng: z.number(),
  /** When the GPS unit on the bus sent this fix. */
  at: IsoDateTime,
});
export type BusPosition = z.infer<typeof BusPosition>;

export const TrackedStop = z.object({
  id: Id,
  name: z.string(),
  time: ClockTime,
  lat: z.number(),
  lng: z.number(),
  passed: z.boolean(),
});

export const LiveLine = z.object({
  line_id: Id,
  line_name: z.string(),
  trip_id: Id.nullable(),
  bus_plate: z.string().nullable(),
  driver_name: z.string().nullable(),
  direction: z.enum(["outbound", "return"]),
  state: z.enum(["not_started", "in_progress", "ended"]),
  position: BusPosition.nullable(),
  delay_minutes: z.number().int().nonnegative(),
  next_stop_name: z.string().nullable(),
  stops: z.array(TrackedStop),
  riders_boarded: z.number().int().nonnegative(),
  riders_total: z.number().int().nonnegative(),
});
export type LiveLine = z.infer<typeof LiveLine>;

export const MyTracking = LiveLine.extend({
  my_stop_id: Id,
  /** Minutes until the bus reaches the student's stop (outbound), or the university (return). */
  eta_minutes: z.number().int().nullable(),
});
export type MyTracking = z.infer<typeof MyTracking>;

export const LocationEvent = z.object({
  line_id: Id,
  position: BusPosition,
  next_stop_name: z.string().nullable(),
});
