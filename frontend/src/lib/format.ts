import type { Locale } from "@/i18n/routing";

export const APP_TIME_ZONE = "Africa/Cairo";
export const PIASTERS_PER_POUND = 100;

const INTL_LOCALE: Record<Locale, string> = {
  // Latin digits in Arabic too: IDs, times and amounts must match receipts and student cards.
  ar: "ar-EG-u-nu-latn",
  en: "en-EG",
};

/** Formats an amount sent by the server in piasters (150000 → "1,500 EGP" / "‏1,500 ج.م."). */
export function formatMoney(piasters: number, locale: Locale): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], {
    style: "currency",
    currency: "EGP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(piasters / PIASTERS_PER_POUND);
}

export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale]).format(value);
}

/** Server timestamps are ISO 8601 in UTC; they are always shown in Cairo time. */
export function formatDateTime(isoUtc: string, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    timeZone: APP_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(isoUtc));
}

export function formatDate(isoUtc: string, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    timeZone: APP_TIME_ZONE,
    dateStyle: "medium",
  }).format(new Date(isoUtc));
}

export function formatTime(isoUtc: string, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(isoUtc));
}

/** A timetable time, "HH:MM" in Cairo time (not an instant), shown as "7:40 AM" / "7:40 ص". */
export function formatClockTime(clock: string, locale: Locale): string {
  const [hours = 0, minutes = 0] = clock.split(":").map(Number);
  // Any fixed day works: the value is already Cairo wall-clock time, so format it in UTC.
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    timeZone: "UTC",
    hour: "numeric",
    minute: "2-digit",
  }).format(Date.UTC(2000, 0, 1, hours, minutes));
}

/** A calendar day sent as "YYYY-MM-DD" (term dates, receipt dates), e.g. "Jan 21, 2027". */
export function formatCalendarDate(
  day: string,
  locale: Locale,
  style: "medium" | "full" = "medium",
): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    timeZone: "UTC",
    dateStyle: style,
  }).format(new Date(`${day}T00:00:00Z`));
}

/** Bytes as "1.2 MB" / "350 KB" for upload limits and chosen files. */
export function formatFileSize(bytes: number, locale: Locale): string {
  const kilobytes = bytes / 1024;
  const useMegabytes = kilobytes >= 1024;
  return new Intl.NumberFormat(INTL_LOCALE[locale], {
    style: "unit",
    unit: useMegabytes ? "megabyte" : "kilobyte",
    maximumFractionDigits: useMegabytes ? 1 : 0,
  }).format(useMegabytes ? kilobytes / 1024 : kilobytes);
}

/** Today's date in Cairo as "YYYY-MM-DD", e.g. the latest allowed payment date. */
export function todayInCairo(now: Date = new Date()): string {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE }).format(now);
}

/** Arabic-Indic digits (٠-٩) and the Arabic decimal mark become Latin, for typed numbers. */
export function toLatinDigits(text: string): string {
  return text
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/٫/g, ".")
    .replace(/[,٬]/g, "");
}
