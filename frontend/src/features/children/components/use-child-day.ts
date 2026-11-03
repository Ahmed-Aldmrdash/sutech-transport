"use client";

import { useEffect } from "react";
import { useAsync } from "@/lib/hooks/use-async";
import { getChildDay } from "../api";

/** Re-reads the day this often until the live WebSocket is in place. */
const DAY_REFRESH_MS = 30_000;

export function useChildDay(studentId: string) {
  const state = useAsync((signal) => getChildDay(studentId, { signal }), [studentId]);
  const { refresh } = state;
  useEffect(() => {
    const timer = setInterval(refresh, DAY_REFRESH_MS);
    return () => clearInterval(timer);
  }, [refresh]);
  return state;
}
