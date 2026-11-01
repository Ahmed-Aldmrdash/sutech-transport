"use client";

import { useEffect, useState } from "react";

const TICK_MS = 1000;

function secondsUntil(deadline: number): number {
  return Math.max(0, Math.ceil((deadline - Date.now()) / TICK_MS));
}

/** Whole seconds left until `deadline` (epoch ms), updated every second. */
export function useCountdown(deadline: number): number {
  const [secondsLeft, setSecondsLeft] = useState(() => secondsUntil(deadline));

  useEffect(() => {
    const update = () => setSecondsLeft(secondsUntil(deadline));
    update();
    const timer = window.setInterval(update, TICK_MS);
    return () => window.clearInterval(timer);
  }, [deadline]);

  return secondsLeft;
}

/** 75 → "1:15". */
export function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
