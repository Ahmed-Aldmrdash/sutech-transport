import { APP_TIME_ZONE } from "./format";

/**
 * A date-and-time field ("2026-11-20T23:59", <input type="datetime-local">) means Cairo time,
 * whatever the device's own zone. These turn it into the ISO instant the server takes, and back.
 */
const MS_PER_MINUTE = 60_000;

function cairoWallClock(instant: number): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: APP_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(instant))
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** "2026-11-20T23:59" in Cairo → the ISO instant, or null if it isn't a valid value. */
export function cairoLocalToIso(local: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
  const asUtc = Date.parse(`${local}:00Z`);
  if (Number.isNaN(asUtc)) return null;
  // Cairo's offset at that moment (summer time moves it), found from the wall clock.
  const offset = (Date.parse(`${cairoWallClock(asUtc)}:00Z`) - asUtc) / MS_PER_MINUTE;
  let instant = asUtc - offset * MS_PER_MINUTE;
  const corrected = (Date.parse(`${cairoWallClock(instant)}:00Z`) - instant) / MS_PER_MINUTE;
  if (corrected !== offset) instant = asUtc - corrected * MS_PER_MINUTE;
  return new Date(instant).toISOString();
}

/** An ISO instant → "YYYY-MM-DDTHH:MM" on Cairo's clock, for a datetime-local field. */
export function isoToCairoLocal(iso: string): string {
  return cairoWallClock(Date.parse(iso));
}
