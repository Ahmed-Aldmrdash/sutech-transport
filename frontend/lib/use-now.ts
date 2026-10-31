"use client";

import { useEffect, useState } from "react";

/** The current time, refreshed every `intervalMs` (countdowns, "updated x ago"). */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** "hh:mm:ss" (or "mm:ss") left until `iso`; never negative. */
export function formatCountdown(iso: string, now: Date): string {
  const total = Math.max(0, Math.floor((new Date(iso).getTime() - now.getTime()) / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}
