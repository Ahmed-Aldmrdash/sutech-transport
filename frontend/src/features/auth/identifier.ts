const ARABIC_INDIC_ZERO = 0x0660;
const EASTERN_ARABIC_INDIC_ZERO = 0x06f0;

/** Turns ٠١٢٣ and ۰۱۲۳ (Arabic keyboards) into 0123. */
function toLatinDigits(value: string): string {
  return value.replace(/[٠-٩۰-۹]/g, (digit) => {
    const code = digit.charCodeAt(0);
    const zero = code >= EASTERN_ARABIC_INDIC_ZERO ? EASTERN_ARABIC_INDIC_ZERO : ARABIC_INDIC_ZERO;
    return String(code - zero);
  });
}

/**
 * Cleans what the user typed before it is sent: Latin digits, no spaces or dashes inside
 * numbers, and emails in lower case. "٢٤٠ ١٠٠ ١٠١" becomes "240100101".
 */
export function normalizeIdentifier(raw: string): string {
  const value = toLatinDigits(raw).trim();
  if (value.includes("@")) return value.toLowerCase();
  if (/^\+?[\d\s-]+$/.test(value)) return value.replace(/[\s-]/g, "");
  return value.toUpperCase();
}

/** Only digits, Latin, at most `maxLength`: what the code box keeps from typing or pasting. */
export function sanitizeCode(raw: string, maxLength: number): string {
  return toLatinDigits(raw).replace(/\D/g, "").slice(0, maxLength);
}
