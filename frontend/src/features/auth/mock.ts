import { ServerErrorCode } from "@/lib/api/errors";
import { MockHttpError, registerMock } from "@/lib/api/mock/mock-server";
import { getMeEndpoint, loginEndpoint, logoutEndpoint, requestOtpEndpoint } from "./api";
import { MOCK_OTP_CODE, findMockAccount, findMockAccountById, maskPhone } from "./mock-accounts";
import { AuthErrorCode } from "./schema";

/** The contract's rules: 5-minute code, 3 attempts, one resend per minute. */
export const MOCK_OTP_RULES = {
  expiresInSeconds: 300,
  attempts: 3,
  resendAfterSeconds: 60,
  lockSeconds: 15 * 60,
  sessionHours: 12,
} as const;

const HTTP = { BadRequest: 400, Unauthorized: 401, Forbidden: 403, NotFound: 404, TooMany: 429 };
const MS_PER_SECOND = 1000;
const MS_PER_HOUR = 3_600_000;
const TOKEN_PREFIX = "mock.";

interface Challenge {
  expiresAt: number;
  attemptsLeft: number;
  sentAt: number;
}

const challenges = new Map<string, Challenge>();
const lockedUntil = new Map<string, number>();
const revokedTokens = new Set<string>();

function throwIfLocked(identifier: string, now: number) {
  const until = lockedUntil.get(identifier) ?? 0;
  if (until > now) {
    throw new MockHttpError(HTTP.TooMany, AuthErrorCode.OtpLocked, "Too many wrong codes.");
  }
}

function encodeToken(userId: string, expiresAt: number): string {
  return TOKEN_PREFIX + btoa(JSON.stringify({ sub: userId, exp: expiresAt }));
}

/** Mock tokens carry the user and expiry, so a reload (fresh mock memory) still knows them. */
function decodeToken(token: string | null): { sub: string; exp: number } | null {
  if (!token?.startsWith(TOKEN_PREFIX) || revokedTokens.has(token)) return null;
  try {
    const payload: unknown = JSON.parse(atob(token.slice(TOKEN_PREFIX.length)));
    const { sub, exp } = payload as { sub?: unknown; exp?: unknown };
    return typeof sub === "string" && typeof exp === "number" ? { sub, exp } : null;
  } catch {
    return null;
  }
}

function unauthorized(): never {
  throw new MockHttpError(HTTP.Unauthorized, ServerErrorCode.Unauthorized, "Sign in again.");
}

registerMock(requestOtpEndpoint, ({ body }) => {
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
  challenges.set(key, {
    expiresAt: now + MOCK_OTP_RULES.expiresInSeconds * MS_PER_SECOND,
    attemptsLeft: MOCK_OTP_RULES.attempts,
    sentAt: now,
  });
  return {
    masked_destination: maskPhone(account.phone),
    name_hint: account.user.name.replace(/^Dr\.\s*/, "").split(" ")[0] ?? account.user.name,
    expires_in_seconds: MOCK_OTP_RULES.expiresInSeconds,
    attempts_left: MOCK_OTP_RULES.attempts,
    code_length: MOCK_OTP_CODE.length,
    resend_after_seconds: MOCK_OTP_RULES.resendAfterSeconds,
    demo_code: MOCK_OTP_CODE,
  };
});

registerMock(loginEndpoint, ({ body }) => {
  const now = Date.now();
  const account = findMockAccount(body.identifier);
  const key = account?.user.identifier ?? body.identifier;
  throwIfLocked(key, now);
  const challenge = challenges.get(key);
  if (!account || !challenge) {
    throw new MockHttpError(HTTP.BadRequest, AuthErrorCode.InvalidOtp, "Ask for a code first.");
  }
  if (challenge.expiresAt <= now) {
    challenges.delete(key);
    throw new MockHttpError(HTTP.BadRequest, AuthErrorCode.OtpExpired, "The code expired.");
  }
  if (body.code !== MOCK_OTP_CODE) {
    challenge.attemptsLeft -= 1;
    if (challenge.attemptsLeft <= 0) {
      challenges.delete(key);
      lockedUntil.set(key, now + MOCK_OTP_RULES.lockSeconds * MS_PER_SECOND);
      throw new MockHttpError(HTTP.TooMany, AuthErrorCode.OtpLocked, "Too many wrong codes.");
    }
    throw new MockHttpError(HTTP.BadRequest, AuthErrorCode.InvalidOtp, "Wrong code.");
  }
  challenges.delete(key);
  const expiresAt = now + MOCK_OTP_RULES.sessionHours * MS_PER_HOUR;
  return {
    token: encodeToken(account.user.id, expiresAt),
    expires_at: new Date(expiresAt).toISOString(),
    user: account.user,
  };
});

registerMock(logoutEndpoint, (_input, { token }) => {
  if (!decodeToken(token)) unauthorized();
  if (token) revokedTokens.add(token);
  return { ok: true as const };
});

registerMock(getMeEndpoint, (_input, { token }) => {
  const payload = decodeToken(token);
  if (!payload || payload.exp <= Date.now()) unauthorized();
  return findMockAccountById(payload.sub)?.user ?? unauthorized();
});

/** Test helper: forget codes, locks and revoked tokens. */
export function resetAuthMock(): void {
  challenges.clear();
  lockedUntil.clear();
  revokedTokens.clear();
}
