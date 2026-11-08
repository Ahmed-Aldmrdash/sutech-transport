import { MockHttpError, registerMock } from "@/lib/api/mock/mock-server";
import { MockStorage, StoredMap } from "@/lib/api/mock/stored-map";
import { Role } from "@/lib/auth/roles";
import { getMeEndpoint, loginEndpoint, logoutEndpoint, requestOtpEndpoint } from "./api";
import { MOCK_OTP_LENGTH, findMockAccount, maskPhone } from "./mock-accounts";
import { firstNameOf, userText } from "./user-text";
import {
  clearRevokedMockTokens,
  decodeMockToken,
  encodeMockToken,
  mockUnauthorized,
  requireMockAccount,
  revokeMockToken,
} from "./mock-token";
import { tokenStore } from "@/lib/api/token-store";
import { AuthErrorCode } from "./schema";

/** The contract's rules: 5-minute code, 3 attempts, one resend per minute. */
export const MOCK_OTP_RULES = {
  expiresInSeconds: 300,
  attempts: 3,
  resendAfterSeconds: 60,
  lockSeconds: 15 * 60,
  /**
   * Students, guardians and crew sign in once and stay signed in (30 days),
   * so nobody needs an SMS code at 6 AM before the bus. Office sessions end after 12 hours.
   */
  sessionDays: { long: 30, office: 0.5 },
} as const;

const HTTP = { BadRequest: 400, Forbidden: 403, NotFound: 404, TooMany: 429 };
const MS_PER_SECOND = 1000;
const MS_PER_DAY = 86_400_000;

interface Challenge {
  code: string;
  expiresAt: number;
  attemptsLeft: number;
  sentAt: number;
}

// Kept in localStorage like a server cache: closing the app on the code step and coming back
// must still accept the code that was sent (the code step itself survives in a cookie).
const challenges = new StoredMap<Challenge>("sut.mock.otp-challenges", MockStorage.Local);
const lockedUntil = new StoredMap<number>("sut.mock.otp-locks", MockStorage.Local);

const LONG_SESSION_ROLES: ReadonlySet<Role> = new Set([
  Role.Student,
  Role.Parent,
  Role.Driver,
  Role.Supervisor,
]);

/** How long a session lasts for this role. */
export function sessionLengthMs(role: Role): number {
  const days = LONG_SESSION_ROLES.has(role)
    ? MOCK_OTP_RULES.sessionDays.long
    : MOCK_OTP_RULES.sessionDays.office;
  return days * MS_PER_DAY;
}

function throwIfLocked(identifier: string, now: number) {
  const until = lockedUntil.get(identifier) ?? 0;
  if (until > now) {
    throw new MockHttpError(HTTP.TooMany, AuthErrorCode.OtpLocked, "Too many wrong codes.");
  }
}

function randomCode(): string {
  const digits = crypto.getRandomValues(new Uint8Array(MOCK_OTP_LENGTH));
  return Array.from(digits, (value) => String(value % 10)).join("");
}

registerMock(requestOtpEndpoint, ({ body }, { language }) => {
  const now = Date.now();
  const account = findMockAccount(body.identifier);
  if (!account) {
    throw new MockHttpError(HTTP.NotFound, AuthErrorCode.UnknownIdentifier, "No such account.");
  }
  if (account.disabled) {
    throw new MockHttpError(HTTP.Forbidden, AuthErrorCode.AccountDisabled, "Account disabled.");
  }
  const key = account.user.identifier;
  throwIfLocked(key, now);
  const previous = challenges.get(key);
  if (previous && now - previous.sentAt < MOCK_OTP_RULES.resendAfterSeconds * MS_PER_SECOND) {
    throw new MockHttpError(HTTP.TooMany, AuthErrorCode.OtpRateLimited, "Wait before resending.");
  }
  // A new code replaces the old one: only the latest code works.
  const code = randomCode();
  challenges.set(key, {
    code,
    expiresAt: now + MOCK_OTP_RULES.expiresInSeconds * MS_PER_SECOND,
    attemptsLeft: MOCK_OTP_RULES.attempts,
    sentAt: now,
  });
  return {
    masked_destination: maskPhone(account.phone),
    name_hint: firstNameOf(userText(account.user, language === "ar" ? "ar" : "en").name),
    expires_in_seconds: MOCK_OTP_RULES.expiresInSeconds,
    attempts_left: MOCK_OTP_RULES.attempts,
    code_length: MOCK_OTP_LENGTH,
    resend_after_seconds: MOCK_OTP_RULES.resendAfterSeconds,
    // Mock and test servers only: shows the code on screen in place of the SMS.
    demo_code: code,
  };
});

registerMock(loginEndpoint, ({ body }) => {
  const now = Date.now();
  const account = findMockAccount(body.identifier);
  const key = account?.user.identifier ?? body.identifier;
  throwIfLocked(key, now);
  const challenge = challenges.get(key);
  if (!account) {
    throw new MockHttpError(HTTP.BadRequest, AuthErrorCode.InvalidOtp, "Ask for a code first.");
  }
  if (!challenge) {
    // No live code (used, replaced or forgotten): tell them to ask for a new one, not "wrong".
    throw new MockHttpError(HTTP.BadRequest, AuthErrorCode.OtpExpired, "Ask for a new code.");
  }
  if (challenge.expiresAt <= now) {
    challenges.delete(key);
    throw new MockHttpError(HTTP.BadRequest, AuthErrorCode.OtpExpired, "The code expired.");
  }
  if (body.code !== challenge.code) {
    challenge.attemptsLeft -= 1;
    challenges.set(key, challenge);
    if (challenge.attemptsLeft <= 0) {
      challenges.delete(key);
      lockedUntil.set(key, now + MOCK_OTP_RULES.lockSeconds * MS_PER_SECOND);
      throw new MockHttpError(HTTP.TooMany, AuthErrorCode.OtpLocked, "Too many wrong codes.");
    }
    throw new MockHttpError(HTTP.BadRequest, AuthErrorCode.InvalidOtp, "Wrong code.");
  }
  challenges.delete(key);
  const expiresAt = now + sessionLengthMs(account.user.role);
  // The real server sets an HttpOnly cookie here; the mock keeps its token in the mock jar.
  tokenStore.set(encodeMockToken(account.user.id, expiresAt));
  return {
    expires_at: new Date(expiresAt).toISOString(),
    user: account.user,
  };
});

registerMock(logoutEndpoint, (_input, { token }) => {
  if (!decodeMockToken(token)) mockUnauthorized();
  if (token) revokeMockToken(token);
  tokenStore.clear();
  return { ok: true as const };
});

registerMock(getMeEndpoint, (_input, { token }) => requireMockAccount(token).user);

/** Test helper: forget codes, locks and revoked tokens. */
export function resetAuthMock(): void {
  challenges.clear();
  lockedUntil.clear();
  clearRevokedMockTokens();
}
