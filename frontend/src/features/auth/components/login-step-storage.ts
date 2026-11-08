import { z } from "zod";
import { writeCookie } from "@/lib/cookies";
import { otpChallengeSchema, type OtpChallenge } from "../schema";

/** Read by the server too, so a reload or language switch renders the code step directly. */
export const LOGIN_STEP_COOKIE = "sut_login_step";
const MS_PER_SECOND = 1000;

const savedStepSchema = z.object({
  identifier: z.string(),
  challenge: otpChallengeSchema,
  sentAt: z.number(),
});

export interface SavedCodeStep {
  identifier: string;
  challenge: OtpChallenge;
  sentAt: number;
}

function expiresAt({ sentAt, challenge }: SavedCodeStep): number {
  return sentAt + challenge.expires_in_seconds * MS_PER_SECOND;
}

/** The saved code step, if the cookie holds a valid one whose code hasn't expired. */
export function parseSavedCodeStep(
  raw: string | undefined,
  now = Date.now(),
): SavedCodeStep | null {
  if (!raw) return null;
  try {
    const parsed = savedStepSchema.safeParse(JSON.parse(decodeURIComponent(raw)));
    return parsed.success && expiresAt(parsed.data) > now ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Remembers the code step in a cookie that lives only as long as the code. It holds no secret
 * in production (only the masked phone and timings; `demo_code` exists in mock mode only).
 */
export const loginStepStorage = {
  save(step: SavedCodeStep): void {
    const maxAge = Math.max(0, Math.floor((expiresAt(step) - Date.now()) / MS_PER_SECOND));
    const value = encodeURIComponent(JSON.stringify(step));
    writeCookie(LOGIN_STEP_COOKIE, value, maxAge);
  },
  clear(): void {
    writeCookie(LOGIN_STEP_COOKIE, "", 0);
  },
};
