"use client";

import { useEffect } from "react";
import { getMe } from "../api";
import { SignInReason } from "../access";
import { sessionStore } from "./session-store";

/** setTimeout can't wait longer than about 24.8 days. */
const MAX_TIMEOUT_MS = 2_147_483_647;

interface SessionWatcherProps {
  token: string;
  expiresAt: string;
}

/**
 * While signed in: ends the session the moment the token expires (also after the phone wakes
 * up), and checks once with the server that the token is still valid and the role unchanged.
 * A 401 from any request ends the session too (see setUnauthorizedHandler).
 */
export function SessionWatcher({ token, expiresAt }: SessionWatcherProps) {
  useEffect(() => {
    const expiresAtMs = Date.parse(expiresAt);
    const check = () => {
      if (expiresAtMs <= Date.now()) sessionStore.end(SignInReason.Expired);
    };
    const delay = Math.min(Math.max(expiresAtMs - Date.now(), 0), MAX_TIMEOUT_MS);
    const timer = window.setTimeout(check, delay);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, [expiresAt]);

  useEffect(() => {
    const controller = new AbortController();
    // A 401 is handled centrally; offline or a server hiccup keeps the saved session.
    getMe({ signal: controller.signal }).then(sessionStore.updateUser, () => undefined);
    return () => controller.abort();
  }, [token]);

  return null;
}
