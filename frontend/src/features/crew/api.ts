import { callEndpoint, type RequestOptions } from "@/lib/api/client";
import { HttpMethod, defineEndpoint } from "@/lib/api/endpoint";
import { Role } from "@/lib/auth/roles";
import {
  crewTodaySchema,
  crewTripSchema,
  delayBodySchema,
  scanBodySchema,
  scanResultSchema,
  tripDelaySchema,
  tripParamsSchema,
  type CrewToday,
  type CrewTrip,
  type DelayBody,
  type ScanBody,
  type ScanResult,
  type TripDelay,
} from "./schema";

const TAG = "crew";
/** The driver and the bus supervisor share these pages until the office says otherwise. */
const CREW = [Role.Driver, Role.Supervisor];
const ROLE_NOTE = "Driver or supervisor of this bus only; any other trip is NOT_YOUR_TRIP (403).";

export const getCrewTodayEndpoint = defineEndpoint({
  id: "crew.getToday",
  method: HttpMethod.Get,
  path: "/driver/trip/today",
  summary:
    "The crew's day: their line, bus and stops, and today's trips (outbound, then return) " +
    "with every subscriber's state (waiting, boarded, checked out, not going, absent), the " +
    "counts, reported delays and the latest SOS. Errors: NO_ASSIGNMENT (404) when the " +
    "account is on no bus today. Live changes arrive on the WebSocket as trip.status and " +
    "attendance.event; until then the app re-reads it every 15 s.",
  tag: TAG,
  access: CREW,
  response: crewTodaySchema,
});

export const startTripEndpoint = defineEndpoint({
  id: "crew.startTrip",
  method: HttpMethod.Post,
  path: "/trips/{trip_id}/start",
  summary:
    "The crew starts the trip; this is how the server knows outbound from return. Students " +
    "and guardians on the line are told the bus left. Errors: TRIP_ALREADY_STARTED (409), " +
    `TRIP_ALREADY_ENDED (409), OTHER_TRIP_IN_PROGRESS (409). ${ROLE_NOTE}`,
  tag: TAG,
  access: CREW,
  idempotent: true,
  params: tripParamsSchema,
  response: crewTripSchema,
});

export const endTripEndpoint = defineEndpoint({
  id: "crew.endTrip",
  method: HttpMethod.Post,
  path: "/trips/{trip_id}/end",
  summary:
    "The crew ends the trip. Business rule 6: every subscriber not scanned (and not " +
    '"not going") becomes absent, and their guardian is told; riders on board are marked ' +
    "arrived. Errors: TRIP_NOT_STARTED (409), TRIP_ALREADY_ENDED (409). " +
    ROLE_NOTE,
  tag: TAG,
  access: CREW,
  idempotent: true,
  params: tripParamsSchema,
  response: crewTripSchema,
});

export const scanEndpoint = defineEndpoint({
  id: "crew.scan",
  method: HttpMethod.Post,
  path: "/trips/{trip_id}/scan",
  summary:
    "Records a boarding or a mid-trip check-out. method qr sends the pass's QR text (signed, " +
    "30 s); manual sends the university ID when the student can't show the pass (logged as " +
    "manual). A check-out needs a reason and tells the guardian at once (no approval). A " +
    '"not going" student who rides anyway is boarded. Errors: TRIP_NOT_STARTED (409), ' +
    "TRIP_ALREADY_ENDED (409), CARD_INVALID (422), CARD_EXPIRED (422), STUDENT_NOT_FOUND " +
    "(404), NOT_ON_THIS_TRIP (409), ALREADY_BOARDED (409), NOT_ON_BOARD (409), " +
    `REASON_REQUIRED (422). ${ROLE_NOTE}`,
  tag: TAG,
  access: CREW,
  idempotent: true,
  params: tripParamsSchema,
  body: scanBodySchema,
  response: scanResultSchema,
});

export const reportDelayEndpoint = defineEndpoint({
  id: "crew.reportDelay",
  method: HttpMethod.Post,
  path: "/trips/{trip_id}/delay",
  summary:
    "Reports a delay on today's trip. The server posts a delay announcement on the line and " +
    "a bus_delayed notification to its students and guardians. Allowed before and during " +
    `the trip. Errors: TRIP_ALREADY_ENDED (409). ${ROLE_NOTE}`,
  tag: TAG,
  access: CREW,
  idempotent: true,
  params: tripParamsSchema,
  body: delayBodySchema,
  response: tripDelaySchema,
});

export function getCrewToday(options?: RequestOptions): Promise<CrewToday> {
  return callEndpoint(getCrewTodayEndpoint, {}, options);
}

export function startTrip(tripId: string, options?: RequestOptions): Promise<CrewTrip> {
  return callEndpoint(startTripEndpoint, { params: { trip_id: tripId } }, options);
}

export function endTrip(tripId: string, options?: RequestOptions): Promise<CrewTrip> {
  return callEndpoint(endTripEndpoint, { params: { trip_id: tripId } }, options);
}

export function scanRider(
  tripId: string,
  body: ScanBody,
  options?: RequestOptions,
): Promise<ScanResult> {
  return callEndpoint(scanEndpoint, { params: { trip_id: tripId }, body }, options);
}

export function reportDelay(
  tripId: string,
  body: DelayBody,
  options?: RequestOptions,
): Promise<TripDelay> {
  return callEndpoint(reportDelayEndpoint, { params: { trip_id: tripId }, body }, options);
}

export const crewEndpoints = [
  getCrewTodayEndpoint,
  startTripEndpoint,
  endTripEndpoint,
  scanEndpoint,
  reportDelayEndpoint,
];
