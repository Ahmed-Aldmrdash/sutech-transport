"use client";

import { useEffect, useState } from "react";
import { useLive } from "@/lib/realtime";
import { type BusPosition, LocationEvent } from "../schema";

/** The bus position from the last API read, then moved by every live GPS fix for the same line. */
export function useLivePosition(lineId: string, initial: BusPosition | null) {
  const [position, setPosition] = useState(initial);
  const [nextStop, setNextStop] = useState<string | null | undefined>(undefined);
  useEffect(() => setPosition(initial), [initial]);
  useLive("bus.location", (data) => {
    const parsed = LocationEvent.safeParse(data);
    if (!parsed.success || parsed.data.line_id !== lineId) return;
    setPosition(parsed.data.position);
    setNextStop(parsed.data.next_stop_name);
  });
  return { position, nextStop };
}
