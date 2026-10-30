import { getDb, saveDb } from "./db";
import { emitMockLive } from "./live-bus";
import { DEMO_ROUTE_MINUTES, positionAt, tripFor } from "./route";

const TICK_MS = 3000;
let timer: ReturnType<typeof setInterval> | null = null;

/** Moves the buses like the GPS units would, and pushes `bus.location` events. */
export function startSimulation(): void {
  if (timer || typeof window === "undefined" || process.env.NODE_ENV === "test") return;
  timer = setInterval(tick, TICK_MS);
}

function tick(): void {
  const db = getDb();
  const step = TICK_MS / (DEMO_ROUTE_MINUTES * 60_000);
  for (const line of db.lines) {
    const trip = tripFor(db, line.id);
    if (trip.simulated && trip.state !== "in_progress") {
      trip.state = "in_progress";
      trip.started_at = new Date().toISOString();
    }
    if (trip.state !== "in_progress") continue;
    trip.progress = trip.simulated ? (trip.progress + step) % 1 : Math.min(1, trip.progress + step);
    const point = positionAt(line, trip.progress, trip.direction);
    emitMockLive("bus.location", {
      line_id: line.id,
      position: { lat: point.lat, lng: point.lng, at: new Date().toISOString() },
    });
  }
  saveDb();
}
