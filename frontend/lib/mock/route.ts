import { addClock, today } from "./clock";
import type { Db, LineRow, TripRow } from "./db";
import { LINE_PATHS, type LinePath } from "./line-paths";

/** Minutes the demo takes to drive a whole route, so the bus visibly moves while you watch. */
export const DEMO_ROUTE_MINUTES = 8;

export function activeStops(line: LineRow) {
  return line.stops.filter((stop) => stop.active);
}

/** The road path for a line, if one exists for its current active stops (editing stops falls back to straight lines). */
function roadPath(line: LineRow): LinePath | null {
  const path = LINE_PATHS[line.id];
  if (!path) return null;
  const ids = activeStops(line).map((stop) => stop.id);
  return ids.length === path.stop_ids.length && ids.every((id, i) => id === path.stop_ids[i]) ? path : null;
}

/** [lat, lng] points the bus drives along for this direction: the roads when known, otherwise stop to stop. */
export function linePath(line: LineRow, direction: TripRow["direction"]): [number, number][] {
  const points = roadPath(line)?.points ?? activeStops(line).map((stop) => [stop.lat, stop.lng] as [number, number]);
  return direction === "outbound" ? points : [...points].reverse();
}

const lengthCache = new WeakMap<[number, number][], number[]>();

/** Point at a fraction (0..1) of a polyline's length. */
function pointAtFraction(points: [number, number][], fraction: number): { lat: number; lng: number } {
  let cumulative = lengthCache.get(points);
  if (!cumulative) {
    cumulative = [0];
    for (let i = 1; i < points.length; i++) {
      cumulative.push(cumulative[i - 1]! + Math.hypot(points[i]![0] - points[i - 1]![0], points[i]![1] - points[i - 1]![1]));
    }
    lengthCache.set(points, cumulative);
  }
  const target = Math.min(Math.max(fraction, 0), 1) * cumulative[cumulative.length - 1]!;
  let i = 1;
  while (i < cumulative.length - 1 && cumulative[i]! < target) i++;
  const span = cumulative[i]! - cumulative[i - 1]! || 1;
  const local = (target - cumulative[i - 1]!) / span;
  const [fromLat, fromLng] = points[i - 1]!;
  const [toLat, toLng] = points[Math.min(i, points.length - 1)]!;
  return { lat: fromLat + (toLat - fromLat) * local, lng: fromLng + (toLng - fromLng) * local };
}

/**
 * Bus position for progress 0..1 (equal weight per stop-to-stop segment, so stop progress and ETAs stay simple).
 * On lines with a road path the bus follows the roads between stops; otherwise it moves in straight lines.
 */
export function positionAt(line: LineRow, progress: number, direction: TripRow["direction"]) {
  const stops = direction === "outbound" ? activeStops(line) : [...activeStops(line)].reverse();
  if (stops.length === 1) return { lat: stops[0]!.lat, lng: stops[0]!.lng, nextIndex: 0 };
  const segments = stops.length - 1;
  const clamped = Math.min(Math.max(progress, 0), 1);
  const scaled = clamped * segments;
  const index = Math.min(Math.floor(scaled), segments - 1);
  const local = scaled - index;
  const nextIndex = clamped >= 1 ? segments : index + 1;
  const road = roadPath(line);
  if (road) {
    const fractions = direction === "outbound" ? road.stop_fractions : road.stop_fractions.map((f) => 1 - f).reverse();
    const fraction = fractions[index]! + (fractions[index + 1]! - fractions[index]!) * local;
    return { ...pointAtFraction(linePath(line, direction), fraction), nextIndex };
  }
  const from = stops[index]!;
  const to = stops[index + 1]!;
  return { lat: from.lat + (to.lat - from.lat) * local, lng: from.lng + (to.lng - from.lng) * local, nextIndex };
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
