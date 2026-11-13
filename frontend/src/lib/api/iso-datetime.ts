import { z } from "zod";

/**
 * A moment from the server: ISO 8601 with seconds and a zone, `2026-11-13T10:00:00Z` or
 * `2026-11-13T12:00:00+02:00` (Python's `isoformat()` writes `+00:00`, not `Z`). Every value
 * is turned into the `Z` form, so the app compares and sorts one shape of string. Values that
 * already end in `Z` are kept exactly as sent.
 */
export function isoDateTime() {
  return z.iso.datetime({ offset: true }).overwrite(toUtcZ);
}

/** Runs after the format check, even when it failed: anything unreadable is left as is. */
function toUtcZ(value: string): string {
  if (value.endsWith("Z")) return value;
  const time = Date.parse(value);
  return Number.isNaN(time) ? value : new Date(time).toISOString();
}
