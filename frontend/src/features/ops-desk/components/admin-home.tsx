"use client";

import { OfficeWelcomePage } from "@/features/auth/components/office-welcome-page";
import { SessionStatus } from "@/features/auth/session/session-store";
import { useSession } from "@/features/auth/session/use-session";
import { Role } from "@/lib/auth/roles";
import { OpsOverviewPage } from "./ops-overview-page";

/**
 * /admin: the Transportation office's overview (the super admin's too). An office without a
 * page there never lands on it; if one does, it gets the welcome page.
 */
export function AdminHome() {
  const state = useSession();
  if (state.status !== SessionStatus.SignedIn) return null;
  const { role } = state.session.user;
  return role === Role.Transport || role === Role.SuperAdmin ? (
    <OpsOverviewPage />
  ) : (
    <OfficeWelcomePage />
  );
}
