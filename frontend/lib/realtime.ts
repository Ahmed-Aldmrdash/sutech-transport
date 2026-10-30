"use client";

import { useEffect, useRef } from "react";
import { isMockMode, WS_URL } from "@/lib/config";
import { readToken } from "@/lib/session";
import { invalidate } from "@/lib/api/use-api";

/** Live event types (front end / back end agreement). */
export type LiveType = "bus.location" | "trip.status" | "attendance.event" | "sos.new" | "sos.update" | "notification.new";

type Handler = (data: unknown) => void;
const handlers = new Map<LiveType, Set<Handler>>();
let started = false;
let socket: WebSocket | null = null;
let retry = 0;

function dispatch(type: string, data: unknown) {
  handlers.get(type as LiveType)?.forEach((handler) => handler(data));
  // Anything except a GPS fix changes what screens show: refresh their data.
  if (type !== "bus.location") invalidate();
}

function connectLive() {
  const token = readToken();
  if (!token || !WS_URL) return;
  socket = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`);
  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(String(event.data)) as { type: string; data: unknown };
      dispatch(message.type, message.data);
    } catch {
      // Ignore malformed frames.
    }
  };
  socket.onopen = () => {
    retry = 0;
  };
  socket.onclose = () => {
    socket = null;
    retry += 1;
    setTimeout(connectLive, Math.min(30_000, 1000 * 2 ** retry));
  };
}

async function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  if (isMockMode) {
    const { onMockLive } = await import("@/lib/mock/live-bus");
    const { startSimulation } = await import("@/lib/mock/simulation");
    onMockLive((message) => dispatch(message.type, message.data));
    startSimulation();
  } else {
    connectLive();
  }
}

/** Subscribes to one live event type for the lifetime of the component. */
export function useLive(type: LiveType, handler: Handler): void {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    void start();
    const wrapped: Handler = (data) => ref.current(data);
    const set = handlers.get(type) ?? new Set<Handler>();
    set.add(wrapped);
    handlers.set(type, set);
    return () => {
      set.delete(wrapped);
    };
  }, [type]);
}
