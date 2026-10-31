"use client";

import { useApi, usePolling } from "@/lib/api/use-api";
import { useLive } from "@/lib/realtime";
import { getCrewTrip } from "../api";

const TRIP_REFRESH_MS = 15_000;

/** Today's trip for the signed-in crew member, kept fresh by live events and a slow poll. */
export function useCrewTrip() {
  const query = useApi(getCrewTrip);
  usePolling(query.reload, TRIP_REFRESH_MS);
  useLive("trip.status", () => undefined);
  return query;
}
