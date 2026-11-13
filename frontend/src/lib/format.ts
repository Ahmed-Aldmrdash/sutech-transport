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

/** The amount part of a formatted price: digits, separators and sign, no currency or marks. */
const AMOUNT_PARTS = new Set<string>(["integer", "group", "decimal", "fraction", "minusSign"]);

/**
 * The same price as formatMoney, split so a narrow card can put the currency on its own line:
 * `{ amount: "15,000", currency: "EGP", currencyFirst: true }` (in Arabic: "ج.م.", after).
 */
export function formatMoneyParts(
  piasters: number,
  locale: Locale,
): { amount: string; currency: string; currencyFirst: boolean } {
  const parts = new Intl.NumberFormat(INTL_LOCALE[locale], {
    style: "currency",
    currency: "EGP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).formatToParts(piasters / PIASTERS_PER_POUND);
  const currencyAt = parts.findIndex((part) => part.type === "currency");
  const amountAt = parts.findIndex((part) => AMOUNT_PARTS.has(part.type));
  return {
    amount: parts
      .filter((part) => AMOUNT_PARTS.has(part.type))
      .map((part) => part.value)
      .join(""),
    currency: parts[currencyAt]?.value ?? "",
    currencyFirst: currencyAt < amountAt,
  };
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

/** The campus arrival: "8:30 AM", or "8:45 AM – 9:00 AM" when it is a window. */
export function formatArrival(window: { from: string; to: string }, locale: Locale): string {
  const from = formatClockTime(window.from, locale);
  return window.from === window.to ? from : `${from} – ${formatClockTime(window.to, locale)}`;
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

/** A calendar day with its weekday, short, for day pickers: "Tue, Nov 3" / "الثلاثاء ٣ نوفمبر". */
export function formatServiceDay(day: string, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "short",
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

/** A calendar day ("YYYY-MM-DD") moved by whole days, e.g. tomorrow for a date picker's min. */
export function addCalendarDays(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Arabic-Indic digits (٠-٩) and the Arabic decimal mark become Latin, for typed numbers. */
export function toLatinDigits(text: string): string {
  return text
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/٫/g, ".")
    .replace(/[,٬]/g, "");
}

/** An Egyptian mobile in groups, "010 0679 6783". Always Latin digits, shown left to right. */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length !== 11) return phone;
  return `${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7)}`;
}
