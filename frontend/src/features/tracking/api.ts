import { callEndpoint, type RequestOptions } from "@/lib/api/client";
import { HttpMethod, defineEndpoint } from "@/lib/api/endpoint";
import { Role } from "@/lib/auth/roles";
import { childParamsSchema } from "@/features/children/schema";
import { trackingSchema, type Tracking } from "./schema";

const TAG = "tracking";

const LIVE_NOTE =
  "Positions come from the GPS device installed in the bus. After the first read, follow " +
  "the `bus.location` WebSocket event for that trip_id (the app re-reads this every 5 s " +
  "until the WebSocket is in place).";

export const getMyTrackingEndpoint = defineEndpoint({
  id: "tracking.getMine",
  method: HttpMethod.Get,
  path: "/tracking/me",
  summary:
    "Where the student's bus is now: latest GPS fix, the trail so far, ETA to their stop or " +
    `to campus, and the bus and driver. trip is null with a reason when there's nothing to follow. ${LIVE_NOTE}`,
  tag: TAG,
  access: [Role.Student],
  response: trackingSchema,
});

export const getChildTrackingEndpoint = defineEndpoint({
  id: "tracking.getChild",
  method: HttpMethod.Get,
  path: "/parent/children/{student_id}/tracking",
  summary:
    "The same live view for one of the guardian's children. Errors: NOT_YOUR_CHILD (403) for " +
    `a student who isn't linked to this guardian. ${LIVE_NOTE}`,
  tag: TAG,
  access: [Role.Parent],
  params: childParamsSchema,
  response: trackingSchema,
});

export function getMyTracking(options?: RequestOptions): Promise<Tracking> {
  return callEndpoint(getMyTrackingEndpoint, {}, options);
}

export function getChildTracking(studentId: string, options?: RequestOptions): Promise<Tracking> {
  return callEndpoint(getChildTrackingEndpoint, { params: { student_id: studentId } }, options);
}

export const trackingEndpoints = [getMyTrackingEndpoint, getChildTrackingEndpoint];
