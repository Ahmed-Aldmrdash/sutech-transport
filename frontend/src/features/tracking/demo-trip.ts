/**
 * Test mode only: a button on the tracking page plays a short pretend trip when no bus is on
 * the road, so the map can be tried in the evening. The mock server reads this key; the real
 * server never sees it.
 */
const DEMO_TRIP_KEY = "sut.mock.demoTripStartedAt";

/** How long the pretend trip takes, first stop to campus. */
export const DEMO_TRIP_MS = 4 * 60_000;
/** It stays "arrived" this long, then the page goes back to "no trip now". */
const DEMO_ARRIVED_MS = 60_000;

export function startDemoTrip(now = Date.now()): void {
  try {
    localStorage.setItem(DEMO_TRIP_KEY, String(now));
  } catch {
    // Private mode: the demo just doesn't start.
  }
}

/** When the running demo trip started, or null if none is running. */
export function demoTripStartedAt(now = Date.now()): number | null {
  try {
    const started = Number(localStorage.getItem(DEMO_TRIP_KEY));
    if (!started || now - started > DEMO_TRIP_MS + DEMO_ARRIVED_MS) return null;
    return started;
  } catch {
    return null;
  }
}
