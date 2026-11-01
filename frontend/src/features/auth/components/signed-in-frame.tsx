"use client";

import { useTranslations } from "next-intl";
import { useEffect, type ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { navigationFor } from "@/features/navigation/nav-config";
import { usePathname, useRouter } from "@/i18n/navigation";
import { SignInReason, canOpen, homePathFor, loginHref } from "../access";
import { SessionStatus } from "../session/session-store";
import { SessionWatcher } from "../session/session-watcher";
import { useSession, useSignOut } from "../session/use-session";
import { FullPageLoader } from "./full-page-loader";

/**
 * Wraps every signed-in page. Signed out → sign-in screen (coming back here after an expiry).
 * Signed in as a role that may not open this page → that role's own home. Nothing protected
 * renders until both checks pass.
 */
export function SignedInFrame({ children }: { children: ReactNode }) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const state = useSession();
  const signOut = useSignOut();

  const user = state.status === SessionStatus.SignedIn ? state.session.user : null;
  const isAllowed = user !== null && canOpen(user.role, pathname);

  useEffect(() => {
    if (state.status === SessionStatus.SignedOut) {
      const expired = state.reason === SignInReason.Expired;
      router.replace(
        loginHref({
          reason: state.reason ?? undefined,
          next: expired ? pathname : undefined,
        }),
      );
    } else if (user && !isAllowed) {
      router.replace(homePathFor(user.role));
    }
  }, [state, user, isAllowed, pathname, router]);

  if (state.status !== SessionStatus.SignedIn || !isAllowed) {
    return <FullPageLoader label={t("session.checking")} />;
  }

  const { session } = state;
  return (
    <AppShell
      navigation={navigationFor(session.user.role)}
      user={{ name: session.user.name, roleLabel: t(`roles.${session.user.role}`) }}
      onSignOut={signOut}
    >
      <SessionWatcher token={session.token} expiresAt={session.expires_at} />
      {children}
    </AppShell>
  );
}
