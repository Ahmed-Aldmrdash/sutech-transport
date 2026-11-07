"use client";

import { useEffect } from "react";
import { useAsync } from "@/lib/hooks/use-async";
import { getCrewToday } from "../api";

/** How often the crew's pages re-read the trip until the WebSocket is in place. */
export const CREW_REFRESH_MS = 15_000;

/** Today's trip for the signed-in driver or supervisor, kept fresh in the background. */
export function useCrewToday() {
  const state = useAsync((signal) => getCrewToday({ signal }), []);
  const { refresh } = state;
  useEffect(() => {
    const timer = setInterval(refresh, CREW_REFRESH_MS);
    return () => clearInterval(timer);
  }, [refresh]);
  return state;
}
