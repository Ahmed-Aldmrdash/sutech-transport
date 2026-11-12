import { ServerErrorCode } from "@/lib/api/errors";
import { Role } from "@/lib/auth/roles";
import { MockHttpError } from "@/lib/api/mock/mock-server";
import { findMockAccountById, type MockAccount } from "./mock-accounts";

const TOKEN_PREFIX = "mock.";
const HTTP_UNAUTHORIZED = 401;
const revokedTokens = new Set<string>();

export function encodeMockToken(userId: string, expiresAt: number): string {
  return TOKEN_PREFIX + btoa(JSON.stringify({ sub: userId, exp: expiresAt }));
}

/** Mock tokens carry the user and expiry, so a reload (fresh mock memory) still knows them. */
export function decodeMockToken(token: string | null): { sub: string; exp: number } | null {
  if (!token?.startsWith(TOKEN_PREFIX) || revokedTokens.has(token)) return null;
  try {
    const payload: unknown = JSON.parse(atob(token.slice(TOKEN_PREFIX.length)));
    const { sub, exp } = payload as { sub?: unknown; exp?: unknown };
    return typeof sub === "string" && typeof exp === "number" ? { sub, exp } : null;
  } catch {
    return null;
  }
}

export function revokeMockToken(token: string): void {
  revokedTokens.add(token);
}

export function clearRevokedMockTokens(): void {
  revokedTokens.clear();
}

export function mockUnauthorized(): never {
  throw new MockHttpError(HTTP_UNAUTHORIZED, ServerErrorCode.Unauthorized, "Sign in again.");
}

/** The signed-in account behind a request, or a 401 like the real server. */
export function requireMockAccount(token: string | null): MockAccount {
  const payload = decodeMockToken(token);
  if (!payload || payload.exp <= Date.now()) mockUnauthorized();
  return findMockAccountById(payload.sub) ?? mockUnauthorized();
}

const HTTP_FORBIDDEN = 403;

/**
 * The signed-in office member, if their office owns this work; the super admin always does.
 * Anyone else gets 403, as the server's role check would answer.
 */
export function requireMockOffice(token: string | null, roles: readonly Role[]): MockAccount {
  const account = requireMockAccount(token);
  if (account.user.role !== Role.SuperAdmin && !roles.includes(account.user.role)) {
    throw new MockHttpError(HTTP_FORBIDDEN, ServerErrorCode.Forbidden, "Not your office.");
  }
  return account;
}

/** "نادية سمير" / "Nadia Samir": a staff member's name in both languages, for logs. */
export function mockNameOf(account: MockAccount): { ar: string; en: string } {
  return { ar: account.user.name_ar ?? account.user.name, en: account.user.name };
}
