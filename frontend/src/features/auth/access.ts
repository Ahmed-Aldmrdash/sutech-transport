import {
  findActiveItem,
  findSoonItem,
  navigationFor,
  roleHomeHref,
} from "@/features/navigation/nav-config";
import type { Role } from "@/lib/auth/roles";

/** Where the sign-in screen lives (without the locale prefix). */
export const LOGIN_PATH = "/login";

/**
 * Holds only the signed-in role (no token), so the server can send a signed-in user straight
 * from the sign-in page to their home without first showing the form. Lives as long as the session.
 */
export const SESSION_ROLE_COOKIE = "sut_session_role";

/** Why the user is on the sign-in screen, shown as a notice there. */
export const SignInReason = {
  Expired: "expired",
  SignedOut: "signed-out",
} as const;
export type SignInReason = (typeof SignInReason)[keyof typeof SignInReason];

export function homePathFor(role: Role): string {
  return roleHomeHref(navigationFor(role));
}

/**
 * Strict separation: a role may open only the pages in its own menu (and pages under them).
 * Everything else, including another role's area or an office page it doesn't own, is refused.
 */
export function canOpen(role: Role, pathname: string): boolean {
  const navigation = navigationFor(role);
  const { basePath } = navigation;
  if (pathname !== basePath && !pathname.startsWith(`${basePath}/`)) return false;
  return (
    findActiveItem(navigation, basePath, pathname) !== undefined ||
    findSoonItem(navigation, pathname) !== undefined
  );
}

/** Accepts only same-site paths like "/student/card", never "//evil.com" or "https://…". */
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return null;
  }
  return value;
}

/** After sign-in: the page the user was sent away from, if their role may open it, else home. */
export function landingPathFor(role: Role, next: string | null | undefined): string {
  const path = safeNextPath(next);
  return path && canOpen(role, path) ? path : homePathFor(role);
}

export function loginHref(options: { next?: string; reason?: SignInReason } = {}): string {
  const search = new URLSearchParams();
  if (options.next) search.set("next", options.next);
  if (options.reason) search.set("reason", options.reason);
  const query = search.toString();
  return query ? `${LOGIN_PATH}?${query}` : LOGIN_PATH;
}
