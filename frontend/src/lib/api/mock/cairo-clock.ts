import { APP_TIME_ZONE } from "@/lib/format";

/** Clock helpers for the mocks, which act like a server running on Cairo time. */

export const MINUTES_PER_HOUR = 60;
export const MS_PER_MINUTE = 60_000;

/** Buses run Sunday to Thursday (0 = Sunday). */
export const SERVICE_DAYS = new Set([0, 1, 2, 3, 4]);

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function toMinutes(clock: string): number {
  const [hours = 0, minutes = 0] = clock.split(":").map(Number);
  return hours * MINUTES_PER_HOUR + minutes;
}

/** Today's date, weekday, minute of the day and UTC offset (minutes) in Cairo. */
export function cairoNow(now: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: APP_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const minute = Number(parts.hour) * MINUTES_PER_HOUR + Number(parts.minute);
  const utcMinute = now.getUTCHours() * MINUTES_PER_HOUR + now.getUTCMinutes();
  const dayShift = date === now.toISOString().slice(0, 10) ? 0 : 24 * MINUTES_PER_HOUR;
  return {
    date,
    weekday: WEEKDAY_INDEX[parts.weekday ?? "Sun"] ?? 0,
    minute,
    offsetMinutes: minute + dayShift - utcMinute,
  };
}

export function addDays(date: string, days: number): string {
  const next = new Date(`${date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

/** The instant of a Cairo wall-clock time ("HH:MM") on a Cairo date, using today's offset. */
export function cairoInstant(date: string, clock: string, offsetMinutes: number): number {
  return Date.parse(`${date}T${clock}:00Z`) - offsetMinutes * MS_PER_MINUTE;
}
