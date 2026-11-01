import { z } from "zod";
import { otpChallengeSchema, type OtpChallenge } from "../schema";

const STORAGE_KEY = "sut.login.code-step";
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

/**
 * Remembers the code step for this tab only, so changing the language (a full page load) or
 * reloading doesn't send the user back to step 1 while their code is still valid.
 */
export const loginStepStorage = {
  read(): SavedCodeStep | null {
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = savedStepSchema.safeParse(JSON.parse(raw));
      if (!parsed.success) return null;
      const { sentAt, challenge } = parsed.data;
      const expiresAt = sentAt + challenge.expires_in_seconds * MS_PER_SECOND;
      return expiresAt > Date.now() ? parsed.data : null;
    } catch {
      return null;
    }
  },
  save(step: SavedCodeStep): void {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(step));
    } catch {
      // Blocked storage: the step just isn't remembered.
    }
  },
  clear(): void {
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Nothing to clear.
    }
  },
};
