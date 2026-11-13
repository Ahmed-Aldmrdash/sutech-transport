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
  if (/^\+?[\d\s().-]+$/.test(value)) return toLocalPhone(value.replace(/[\s().-]/g, ""));
  return value.toUpperCase();
}

/** Egypt's country code typed the WhatsApp way: +201000002000 or 00201000002000 → 01000002000. */
function toLocalPhone(digits: string): string {
  const international = /^(?:\+|00)20(1\d{9})$/.exec(digits);
  return international ? `0${international[1]}` : digits;
}

const STUDENT_ID_LENGTH = 9;
const PHONE_LENGTH = 11;

/**
 * A hint for a number that can't be right, before asking the server: student IDs are 9 digits
 * and phones 11 digits starting with 01. Null when the shape is fine (or it isn't a number).
 */
export function identifierShapeError(value: string): "studentIdLength" | "phoneLength" | null {
  if (!/^\d+$/.test(value)) return null;
  if (value.startsWith("01")) return value.length === PHONE_LENGTH ? null : "phoneLength";
  return value.length === STUDENT_ID_LENGTH ? null : "studentIdLength";
}

/** Only digits, Latin, at most `maxLength`: what the code box keeps from typing or pasting. */
export function sanitizeCode(raw: string, maxLength: number): string {
  return toLatinDigits(raw).replace(/\D/g, "").slice(0, maxLength);
}
