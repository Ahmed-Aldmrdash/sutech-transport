import type { z } from "zod";
import { call } from "@/lib/api/client";
import { Ok } from "@/lib/api/common";
import { defineEndpoint } from "@/lib/api/endpoint";
import { Role } from "@/features/auth/roles";
import { CrewTrip, ReportDelay, type Scan as ScanInput, Scan, ScanResult, StartTrip } from "./schema";

const CREW = [Role.Driver, Role.Supervisor] as const;

export const endpoints = {
  today: defineEndpoint({
    tag: "trips",
    method: "GET",
    path: "/driver/trip/today",
    summary: "The crew member's trip today with the rider list.",
    roles: CREW,
    response: CrewTrip,
  }),
  start: defineEndpoint({
    tag: "trips",
    method: "POST",
    path: "/trips/{trip_id}/start",
    summary: "Start the outbound or return trip (driver only).",
    roles: [Role.Driver],
    body: StartTrip,
    response: CrewTrip,
    idempotent: true,
  }),
  end: defineEndpoint({
    tag: "trips",
    method: "POST",
    path: "/trips/{trip_id}/end",
    summary:
      "End the trip. Ending the outbound trip marks every subscriber who wasn't scanned and didn't report not going as absent, and notifies their parents.",
    roles: [Role.Driver],
    response: CrewTrip,
    idempotent: true,
  }),
  scan: defineEndpoint({
    tag: "trips",
    method: "POST",
    path: "/trips/{trip_id}/scan",
    summary:
      "Scan a card to board, or to check out mid-trip with a reason (the parent is notified at once). Rejects cancelled cards and other lines.",
    roles: CREW,
    body: Scan,
    response: ScanResult,
    idempotent: true,
  }),
  delay: defineEndpoint({
    tag: "trips",
    method: "POST",
    path: "/trips/{trip_id}/delay",
    summary: "Report a delay; the line's students and the transport office are told.",
    roles: CREW,
    body: ReportDelay,
    response: Ok,
  }),
};

export const getCrewTrip = () => call(endpoints.today);
export const startTrip = (tripId: string, direction: "outbound" | "return") =>
  call(endpoints.start, { params: { trip_id: tripId }, body: { direction } });
export const endTrip = (tripId: string) => call(endpoints.end, { params: { trip_id: tripId } });
export const scanCard = (tripId: string, body: ScanInput) => call(endpoints.scan, { params: { trip_id: tripId }, body });
export const reportDelay = (tripId: string, minutes: number, reason: ReportDelayReason) =>
  call(endpoints.delay, { params: { trip_id: tripId }, body: { minutes, reason } });

export type ReportDelayReason = z.infer<typeof ReportDelay>["reason"];
