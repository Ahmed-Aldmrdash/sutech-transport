"use client";

import { useEffect, useState } from "react";

/** The current time, refreshed every `intervalMs`, for countdowns ("23 h 10 min left"). */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
