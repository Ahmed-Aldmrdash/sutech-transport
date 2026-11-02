import { callEndpoint, type RequestOptions } from "@/lib/api/client";
import { HttpMethod, defineEndpoint } from "@/lib/api/endpoint";
import { Role } from "@/lib/auth/roles";
import { myNextTripSchema, type MyNextTrip } from "./schema";

export const getMyNextTripEndpoint = defineEndpoint({
  id: "trips.getMyNext",
  method: HttpMethod.Get,
  path: "/trips/next",
  summary:
    "The active subscriber's next trip: date, their stop and pickup time, the bus, and where " +
    "the bus is now (from its GPS device). trip is null for students without an active " +
    "subscription. Live changes arrive on the WebSocket as bus.location and trip.status.",
  tag: "trips",
  access: [Role.Student],
  response: myNextTripSchema,
});

export function getMyNextTrip(options?: RequestOptions): Promise<MyNextTrip> {
  return callEndpoint(getMyNextTripEndpoint, {}, options);
}

export const tripsEndpoints = [getMyNextTripEndpoint];
