import { CAIRO_TIME_ZONE, cairoDate } from "@/lib/time";

export const now = () => new Date();
export const nowIso = () => new Date().toISOString();
export const today = () => cairoDate(new Date());

/** Cairo's UTC offset in minutes on a given date (Egypt observes summer time). */
function cairoOffsetMinutes(date: string): number {
  const probe = new Date(`${date}T12:00:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CAIRO_TIME_ZONE,
    hour: "2-digit",
    hour12: false,
  }).formatToParts(probe);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "12");
  return (hour - 12) * 60;
}

/** "2026-10-30" + "06:40" (Cairo wall time) → UTC ISO string. */
export function cairoIso(date: string, clock: string): string {
  const [hours = 0, minutes = 0] = clock.split(":").map(Number);
  const utc = Date.UTC(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10)),
    hours,
    minutes,
  );
  return new Date(utc - cairoOffsetMinutes(date) * 60_000).toISOString();
}

export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

export function addClock(clock: string, minutes: number): string {
  const [h = 0, m = 0] = clock.split(":").map(Number);
  const total = (h * 60 + m + minutes + 24 * 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
