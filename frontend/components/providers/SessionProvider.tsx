"use client";

import { type ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getMe, logout } from "@/features/auth/api";
import type { Me } from "@/features/auth/schema";
import { SESSION_EXPIRED_EVENT } from "@/lib/api/client";
import { readToken, writeToken } from "@/lib/session";

type SessionState = { status: "loading" } | { status: "anonymous" } | { status: "authenticated"; user: Me };

interface SessionContextValue {
  session: SessionState;
  signIn: (token: string, user: Me) => void;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState>({ status: "loading" });

  useEffect(() => {
    if (!readToken()) {
      setSession({ status: "anonymous" });
      return;
    }
    getMe()
      .then((user) => setSession({ status: "authenticated", user }))
      .catch(() => {
        writeToken(null);
        setSession({ status: "anonymous" });
      });
    const expired = () => setSession({ status: "anonymous" });
    window.addEventListener(SESSION_EXPIRED_EVENT, expired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, expired);
  }, []);

  const signIn = useCallback((token: string, user: Me) => {
    writeToken(token);
    setSession({ status: "authenticated", user });
  }, []);

  const signOut = useCallback(async () => {
    try {
      await logout();
    } catch {
      // Already signed out on the server; clear locally anyway.
    }
    writeToken(null);
    setSession({ status: "anonymous" });
  }, []);

  const value = useMemo(() => ({ session, signIn, signOut }), [session, signIn, signOut]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession outside SessionProvider");
  return value;
}

/** The signed-in user; only call inside a guarded area. */
export function useMe(): Me {
  const { session } = useSession();
  if (session.status !== "authenticated") throw new Error("useMe outside a guarded area");
  return session.user;
}
