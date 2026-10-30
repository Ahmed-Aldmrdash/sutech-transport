export const CAIRO_TIME_ZONE = "Africa/Cairo";

const intlLocale = (locale: string) => (locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB");

export function formatTime(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: CAIRO_TIME_ZONE,
  }).format(new Date(iso));
}

export function formatDate(iso: string, locale: string, withWeekday = false): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: "long",
    year: "numeric",
    weekday: withWeekday ? "long" : undefined,
    timeZone: CAIRO_TIME_ZONE,
  }).format(new Date(iso));
}

export function formatDateTime(iso: string, locale: string): string {
  return `${formatDate(iso, locale)} · ${formatTime(iso, locale)}`;
}

/** Calendar date (YYYY-MM-DD) of an instant, in Cairo. */
export function cairoDate(iso: string | Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CAIRO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(typeof iso === "string" ? new Date(iso) : iso);
  return parts;
}

export function minutesUntil(iso: string, now: Date = new Date()): number {
  return Math.round((new Date(iso).getTime() - now.getTime()) / 60_000);
}

export function daysUntil(dateOnly: string, now: Date = new Date()): number {
  const today = new Date(`${cairoDate(now)}T00:00:00Z`).getTime();
  const target = new Date(`${dateOnly}T00:00:00Z`).getTime();
  return Math.round((target - today) / 86_400_000);
}

/** A daily timetable slot ("07:15", Cairo) as "7:15 ص" / "7:15 am". */
export function formatClock(clock: string, locale: string): string {
  const [hours = 0, minutes = 0] = clock.split(":").map(Number);
  return new Intl.DateTimeFormat(intlLocale(locale), { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "UTC" }).format(
    new Date(Date.UTC(2000, 0, 1, hours, minutes)),
  );
}

/** Minutes Cairo is ahead of UTC at an instant (120 in winter, 180 in summer time). */
function cairoOffsetMinutes(at: Date): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: CAIRO_TIME_ZONE,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(at)
      .map((part) => [part.type, part.value]),
  );
  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
  return Math.round((asUtc - Math.floor(at.getTime() / 60_000) * 60_000) / 60_000);
}

/** A datetime-local value typed in Cairo time ("2026-11-02T08:30") as an ISO UTC instant. */
export function cairoLocalToIso(local: string): string {
  const [date = "", time = "00:00"] = local.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  const guess = Date.UTC(year!, month! - 1, day!, hours!, minutes!);
  const offset = cairoOffsetMinutes(new Date(guess - cairoOffsetMinutes(new Date(guess)) * 60_000));
  return new Date(guess - offset * 60_000).toISOString();
}
