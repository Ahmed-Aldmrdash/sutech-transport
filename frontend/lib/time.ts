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
