import { addClock, today } from "./clock";
import type { Db, LineRow, TripRow } from "./db";

/** Minutes the demo takes to drive a whole route, so the bus visibly moves while you watch. */
export const DEMO_ROUTE_MINUTES = 8;

export function activeStops(line: LineRow) {
  return line.stops.filter((stop) => stop.active);
}

/** Bus position along the stops' polyline for progress 0..1 (equal weight per segment). */
export function positionAt(line: LineRow, progress: number, direction: TripRow["direction"]) {
  const stops = direction === "outbound" ? activeStops(line) : [...activeStops(line)].reverse();
  if (stops.length === 1) return { lat: stops[0]!.lat, lng: stops[0]!.lng, nextIndex: 0 };
  const segments = stops.length - 1;
  const clamped = Math.min(Math.max(progress, 0), 1);
  const scaled = clamped * segments;
  const index = Math.min(Math.floor(scaled), segments - 1);
  const local = scaled - index;
  const from = stops[index]!;
  const to = stops[index + 1]!;
  return {
    lat: from.lat + (to.lat - from.lat) * local,
    lng: from.lng + (to.lng - from.lng) * local,
    nextIndex: clamped >= 1 ? segments : index + 1,
  };
}

export function progressOfStop(line: LineRow, stopId: string, direction: TripRow["direction"]): number {
  const stops = direction === "outbound" ? activeStops(line) : [...activeStops(line)].reverse();
  const index = stops.findIndex((stop) => stop.id === stopId);
  if (index < 0 || stops.length < 2) return 1;
  return index / (stops.length - 1);
}

export function etaMinutes(progressNow: number, progressTarget: number, delay: number): number | null {
  if (progressTarget < progressNow) return null;
  return Math.max(0, Math.round((progressTarget - progressNow) * DEMO_ROUTE_MINUTES)) + delay;
}

export function tripFor(db: Db, lineId: string): TripRow {
  const day = today();
  let trip = db.trips.find((row) => row.line_id === lineId && row.date === day);
  if (!trip) {
    const line = db.lines.find((row) => row.id === lineId)!;
    trip = {
      id: `T-${lineId}-${day}-out`,
      line_id: lineId,
      date: day,
      direction: "outbound",
      state: "not_started",
      started_at: null,
      ended_at: null,
      bus_id: line.bus_id ?? "",
      progress: 0,
      simulated: lineId !== "L1",
      riders: {},
    };
    db.trips.push(trip);
  }
  return trip;
}

/** Scheduled clock time at a stop for the return trip (leaves the gate at RETURN_DEPARTURE). */
export const RETURN_DEPARTURE = "16:45";
export function returnTime(line: LineRow, stopIndexFromGate: number): string {
  return addClock(RETURN_DEPARTURE, stopIndexFromGate * 10);
}
