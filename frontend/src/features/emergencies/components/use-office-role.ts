"use client";

import { SessionStatus } from "@/features/auth/session/session-store";
import { useSession } from "@/features/auth/session/use-session";
import { Role } from "@/lib/auth/roles";

function useRole(): Role | null {
  const state = useSession();
  return state.status === SessionStatus.SignedIn ? state.session.user.role : null;
}

/** Whether the signed-in office member may send another bus or driver (Transportation only). */
export function useCanSendReplacement(): boolean {
  return useRole() === Role.Transport;
}

/**
 * The super admin watches the SOS and clinic desk and the bus company's portal, but acts on
 * neither: the offices that own the work do.
 */
export function useIsViewOnly(): boolean {
  return useRole() === Role.SuperAdmin;
}
