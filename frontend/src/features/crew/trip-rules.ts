import { CrewTripStatus, RiderState, type CrewToday, type CrewTrip, type Rider } from "./schema";

/**
 * The trip the crew is working on: the one running, else the first not ended yet, else the
 * last one (to show its summary). null on a day without trips.
 */
export function currentTrip(today: CrewToday): CrewTrip | null {
  return (
    today.trips.find((trip) => trip.status === CrewTripStatus.InProgress) ??
    today.trips.find((trip) => trip.status === CrewTripStatus.NotStarted) ??
    today.trips.at(-1) ??
    null
  );
}

/** Another trip is running, so this one can't start yet. */
export function isBlockedByOtherTrip(today: CrewToday, trip: CrewTrip): boolean {
  return today.trips.some(
    (other) => other.trip_id !== trip.trip_id && other.status === CrewTripStatus.InProgress,
  );
}

/** Riders the end of the trip will mark absent: not scanned and not "not going". */
export function waitingRiders(trip: CrewTrip): Rider[] {
  return trip.riders.filter((rider) => rider.state === RiderState.Waiting);
}

/** Riders grouped by their stop, in stop order. */
export function ridersByStop(riders: readonly Rider[]) {
  const groups = new Map<number, { order: number; name: string; riders: Rider[] }>();
  for (const rider of riders) {
    const group = groups.get(rider.stop_order) ?? {
      order: rider.stop_order,
      name: rider.stop_name,
      riders: [],
    };
    group.riders.push(rider);
    groups.set(rider.stop_order, group);
  }
  return [...groups.values()].sort((a, b) => a.order - b.order);
}

/** Free-text search on name or university ID, in either script. */
export function matchesSearch(rider: Rider, search: string): boolean {
  const text = search.trim().toLowerCase();
  if (!text) return true;
  return rider.name.toLowerCase().includes(text) || rider.identifier.toLowerCase().includes(text);
}
