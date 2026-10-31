/* Mock signing for the card QR. The real server signs with a secret key (HMAC); this only imitates the shape. */
export const QR_TTL_SECONDS = 30;
const GRACE_SECONDS = 15;
const SECRET = "sutech-mock-secret";

function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function signCard(studentId: string, nowMs = Date.now()) {
  const expires = Math.floor(nowMs / 1000) + QR_TTL_SECONDS;
  return { token: `SUT1.${studentId}.${expires}.${fnv1a(`${studentId}.${expires}.${SECRET}`)}`, expiresAt: new Date(expires * 1000) };
}

export type CardCheck = { ok: true; studentId: string } | { ok: false; reason: "invalid" | "expired" };

/** Accepts a scanned token, or a typed 9-digit student ID (the crew's fallback when the camera can't read). */
export function verifyCard(input: string, nowMs = Date.now()): CardCheck {
  const value = input.trim();
  if (/^\d{9}$/.test(value)) return { ok: true, studentId: value };
  const [version, studentId, expires, signature] = value.split(".");
  if (version !== "SUT1" || !studentId || !expires || !signature) return { ok: false, reason: "invalid" };
  if (fnv1a(`${studentId}.${expires}.${SECRET}`) !== signature) return { ok: false, reason: "invalid" };
  if (Number(expires) + GRACE_SECONDS < nowMs / 1000) return { ok: false, reason: "expired" };
  return { ok: true, studentId };
}
