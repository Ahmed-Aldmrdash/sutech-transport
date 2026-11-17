"use client";

import { useEffect } from "react";
import { isMockMode } from "@/lib/config";
import { useAsync } from "@/lib/hooks/use-async";
import { getCrewToday } from "../api";

/** How often the crew's pages re-read the trip until the WebSocket is in place. */
const CREW_REFRESH_MS = 10_000;

/**
 * Today's trip for the signed-in driver or supervisor, kept fresh in the background: every
 * 10 s, when the app comes back to the screen, and (demo only) the moment another tab of the
 * mock changes the trip, so the driver sees at once that the supervisor started it.
 */
export function useCrewToday() {
  const state = useAsync((signal) => getCrewToday({ signal }), []);
  const { refresh } = state;
  useEffect(() => {
    const timer = setInterval(refresh, CREW_REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key?.startsWith("sut.mock.")) refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    if (isMockMode) window.addEventListener("storage", onStorage);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("storage", onStorage);
    };
  }, [refresh]);
  return state;
}
