"use client";

import { SessionStatus } from "@/features/auth/session/session-store";
import { useSession } from "@/features/auth/session/use-session";
import { Role } from "@/lib/auth/roles";

/** Whether the signed-in office member may send another bus or driver (Transportation only). */
export function useCanSendReplacement(): boolean {
  const state = useSession();
  if (state.status !== SessionStatus.SignedIn) return false;
  const { role } = state.session.user;
  return role === Role.Transport || role === Role.SuperAdmin;
}
