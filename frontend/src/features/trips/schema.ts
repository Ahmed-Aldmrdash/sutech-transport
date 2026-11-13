import { z } from "zod";
import { isoDateTime } from "@/lib/api/iso-datetime";
import {
  arrivalWindowSchema,
  busSchema,
  clockTimeSchema,
  lineSummarySchema,
} from "@/features/lines/schema";
import { calendarDateSchema } from "@/features/subscriptions/schema";

export const TripDirection = { Outbound: "outbound", Return: "return" } as const;
export type TripDirection = (typeof TripDirection)[keyof typeof TripDirection];

/**
 * Where the bus is relative to the student, worked out by the server from the bus's GPS device.
 * scheduled: not on its way yet · approaching: heading to the student's stop (eta_minutes) ·
 * passed_stop: picked up at the student's stop, heading to campus · arrived: at campus.
 */
export const TripStatus = {
  Scheduled: "scheduled",
  Approaching: "approaching",
  PassedStop: "passed_stop",
  Arrived: "arrived",
} as const;
export type TripStatus = (typeof TripStatus)[keyof typeof TripStatus];

export const nextTripSchema = z.object({
  trip_id: z.string(),
  service_date: calendarDateSchema,
  direction: z.enum([TripDirection.Outbound, TripDirection.Return]),
  line: lineSummarySchema,
  stop: z.object({ name: z.string(), pickup_time: clockTimeSchema.nullable() }),
  campus_arrival: arrivalWindowSchema,
  /** null until the Transportation office publishes return times. */
  return_departure_time: clockTimeSchema.nullable(),
  /** The bus and driver (with the driver's mobile, since the student rides this line). */
  bus: busSchema.nullable(),
  status: z.enum([
    TripStatus.Scheduled,
    TripStatus.Approaching,
    TripStatus.PassedStop,
    TripStatus.Arrived,
  ]),
  /** Minutes until the bus reaches the student's stop (approaching) or campus (passed_stop). */
  eta_minutes: z.number().int().nonnegative().nullable(),
  /** The last stop the bus passed, from GPS. */
  near_stop: z.string().nullable(),
  /** When the GPS position behind this status was taken. null before the trip starts. */
  location_updated_at: isoDateTime().nullable(),
});
export type NextTrip = z.infer<typeof nextTripSchema>;

export const myNextTripSchema = z.object({ trip: nextTripSchema.nullable() });
export type MyNextTrip = z.infer<typeof myNextTripSchema>;
