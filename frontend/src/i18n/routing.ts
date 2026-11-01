import { defineRouting } from "next-intl/routing";

export const LOCALES = ["ar", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "ar";

/** Text direction per locale. Arabic is right-to-left. */
export const LOCALE_DIRECTION: Record<Locale, "rtl" | "ltr"> = {
  ar: "rtl",
  en: "ltr",
};

export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: "always",
  localeCookie: { name: "SUT_LOCALE", maxAge: 60 * 60 * 24 * 365 },
});
