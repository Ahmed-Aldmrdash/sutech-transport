"use client";

import { Role } from "@/lib/auth/roles";
import { SessionStatus } from "./session-store";
import { useSession } from "./use-session";

/** Staff ride for free and have no guardian, so the rider pages word some things differently. */
export function useIsEmployee(): boolean {
  const session = useSession();
  return session.status === SessionStatus.SignedIn && session.session.user.role === Role.Employee;
}
