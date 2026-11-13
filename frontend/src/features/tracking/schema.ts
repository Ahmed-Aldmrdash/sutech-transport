import { z } from "zod";
import { isoDateTime } from "@/lib/api/iso-datetime";
import {
  arrivalWindowSchema,
  busSchema,
  clockTimeSchema,
  geoPointSchema,
  lineSummarySchema,
} from "@/features/lines/schema";
import { calendarDateSchema } from "@/features/subscriptions/schema";
import { TripDirection, TripStatus } from "@/features/trips/schema";

/**
 * One GPS fix from the device installed in the bus (not the driver's phone). The server keeps
 * the latest one per bus and pushes new ones on the WebSocket as `bus.location`.
 */
const busPositionSchema = geoPointSchema.extend({
  /** Compass direction of travel, 0 = north, clockwise. null when standing still. */
  heading: z.number().min(0).max(360).nullable(),
  speed_kmh: z.number().nonnegative(),
  recorded_at: isoDateTime(),
});

/** Why there's no bus to follow right now. */
export const NoTrackingReason = {
  /** No active subscription (or, for a guardian, the child has none). */
  NoSubscription: "no_subscription",
  /** The bus isn't on the road: before the trip starts, after it ends, or not a service day. */
  NoTripNow: "no_trip_now",
} as const;
export type NoTrackingReason = (typeof NoTrackingReason)[keyof typeof NoTrackingReason];

export const liveTripSchema = z.object({
  trip_id: z.string(),
  service_date: calendarDateSchema,
  direction: z.enum([TripDirection.Outbound, TripDirection.Return]),
  line: lineSummarySchema,
  bus: busSchema,
  /** The rider's own stop on this line. */
  stop: z.object({ name: z.string(), pickup_time: clockTimeSchema.nullable() }),
  campus_arrival: arrivalWindowSchema,
  status: z.enum([
    TripStatus.Scheduled,
    TripStatus.Approaching,
    TripStatus.PassedStop,
    TripStatus.Arrived,
  ]),
  /** Minutes to the rider's stop (approaching) or to campus (passed_stop). */
  eta_minutes: z.number().int().nonnegative().nullable(),
  /** The last stop the bus passed. */
  near_stop: z.string().nullable(),
  /** Latest GPS fix. null if the device hasn't reported on this trip yet. */
  position: busPositionSchema.nullable(),
  /** Where the bus has been on this trip, oldest first, about one point a minute. */
  trail: z.array(geoPointSchema),
  /** The rider's stop pin. null until the office sends real stop locations. */
  stop_location: geoPointSchema.nullable(),
  campus_location: geoPointSchema,
});
export type LiveTrip = z.infer<typeof liveTripSchema>;

export const trackingSchema = z.object({
  /** null when there's nothing to follow; `reason` says why. */
  trip: liveTripSchema.nullable(),
  reason: z.enum([NoTrackingReason.NoSubscription, NoTrackingReason.NoTripNow]).nullable(),
  /** When the next trip starts (the bus leaves its first stop), for "no_trip_now". */
  next_departure_at: isoDateTime().nullable(),
});
export type Tracking = z.infer<typeof trackingSchema>;
