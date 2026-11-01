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
