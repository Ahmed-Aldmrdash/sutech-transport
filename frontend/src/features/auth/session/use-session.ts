"use client";

import { useCallback, useSyncExternalStore } from "react";
import { logout } from "../api";
import { SignInReason } from "../access";
import { sessionStore, type SessionState } from "./session-store";

export function useSession(): SessionState {
  return useSyncExternalStore(
    sessionStore.subscribe,
    sessionStore.getSnapshot,
    sessionStore.getServerSnapshot,
  );
}

/**
 * Signs out at once on this device, and asks the server to revoke the token in the background.
 * The request is built (with the token) before the session is cleared.
 */
export function useSignOut(): () => void {
  return useCallback(() => {
    void logout().catch(() => undefined);
    sessionStore.end(SignInReason.SignedOut);
  }, []);
}
