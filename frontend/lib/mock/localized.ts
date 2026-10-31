/** Mock data that the server would return in the caller's language (Accept-Language). */
export type Localized = string | { ar: string; en: string };

export function tx(value: Localized, locale: string): string {
  if (typeof value === "string") return value;
  return locale === "en" ? value.en : value.ar;
}

export const both = (ar: string, en: string): Localized => ({ ar, en });
