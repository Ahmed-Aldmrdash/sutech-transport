"use client";

import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import { userText } from "../user-text";
import { useEffect, type ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { navigationFor } from "@/features/navigation/nav-config";
import { NotificationBell } from "@/features/notifications/components/notification-bell";
import { NotificationsWatcher } from "@/features/notifications/components/notifications-watcher";
import { useUnreadCount } from "@/features/notifications/unread-store";
import { SosAlarm } from "@/features/emergencies/components/sos-alarm";
import { Role } from "@/lib/auth/roles";
import { usePathname, useRouter } from "@/i18n/navigation";
import { SignInReason, canOpen, homePathFor, loginHref } from "../access";
import { SessionStatus } from "../session/session-store";
import { SessionWatcher } from "../session/session-watcher";
import { useSession, useSignOut } from "../session/use-session";
import { FullPageLoader } from "./full-page-loader";

/** Offices that take SOS alerts, so every page of theirs rings when one arrives. */
const SOS_DESK_ROLES: readonly Role[] = [Role.SuperAdmin, Role.Transport, Role.Clinic];

/** Roles with a notifications page, and where it is. */
const NOTIFICATIONS_PATH: Partial<Record<Role, string>> = {
  [Role.Student]: "/student/notifications",
  [Role.Parent]: "/parent/notifications",
};

/**
 * Wraps every signed-in page. Signed out → sign-in screen (coming back here after an expiry).
 * Signed in as a role that may not open this page → that role's own home. Nothing protected
 * renders until both checks pass.
 */
export function SignedInFrame({ children }: { children: ReactNode }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const state = useSession();
  const signOut = useSignOut();
  const unreadCount = useUnreadCount();

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
  const notificationsPath = NOTIFICATIONS_PATH[session.user.role];
  return (
    <AppShell
      navigation={navigationFor(session.user.role)}
      user={{
        name: userText(session.user, locale).name,
        roleLabel: t(`roles.${session.user.role}`),
      }}
      onSignOut={signOut}
      topBarActions={
        notificationsPath ? (
          <NotificationBell href={notificationsPath} className="hidden desktop:inline-flex" />
        ) : null
      }
      badges={notificationsPath ? { notifications: unreadCount } : undefined}
    >
      <SessionWatcher token={session.token} expiresAt={session.expires_at} />
      {notificationsPath ? <NotificationsWatcher /> : null}
      {SOS_DESK_ROLES.includes(session.user.role) ? <SosAlarm /> : null}
      {children}
    </AppShell>
  );
}
