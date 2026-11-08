"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isApiError } from "@/lib/api/errors";
import { saveCard } from "../saved-card";
import { getMyCard } from "../api";
import { CardErrorCode, type StudentCard } from "../schema";

/** Ask for the next code this long before the current one expires. */
const REFRESH_LEAD_MS = 3000;
const MIN_REFRESH_DELAY_MS = 1000;
/** After a failed refresh, try again this often (the phone may be back online). */
const RETRY_DELAY_MS = 5000;

export const CardLoadState = {
  Loading: "loading",
  Ready: "ready",
  Locked: "locked",
  Error: "error",
} as const;
export type CardLoadState = (typeof CardLoadState)[keyof typeof CardLoadState];

/**
 * Loads the pass and keeps its QR code fresh: a new signed token just before each one expires.
 * If a refresh fails, the last card stays on screen and the code is shown as expired.
 */
export function useRotatingCard() {
  const [state, setState] = useState<CardLoadState>(CardLoadState.Loading);
  const [card, setCard] = useState<StudentCard | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controller = useRef<AbortController | null>(null);
  // The scheduled refresh calls the latest `load` through this ref.
  const loadRef = useRef<() => Promise<void>>(() => Promise.resolve());

  const load = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setIsRefreshing(true);
    try {
      const next = await getMyCard({ signal: current.signal });
      if (current.signal.aborted) return;
      setCard(next);
      setState(CardLoadState.Ready);
      saveCard(next);
      const delay = Date.parse(next.qr.expires_at) - Date.now() - REFRESH_LEAD_MS;
      timer.current = setTimeout(
        () => void loadRef.current(),
        Math.max(MIN_REFRESH_DELAY_MS, delay),
      );
    } catch (caught) {
      if (current.signal.aborted) return;
      setError(caught);
      if (isApiError(caught) && caught.code === CardErrorCode.NotSubscribed) {
        setState(CardLoadState.Locked);
        setCard(null);
        return;
      }
      setState((previous) => (previous === CardLoadState.Ready ? previous : CardLoadState.Error));
      timer.current = setTimeout(() => void loadRef.current(), RETRY_DELAY_MS);
    } finally {
      if (!current.signal.aborted) setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadRef.current = load;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- first load on mount
    void load();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      controller.current?.abort();
    };
  }, [load]);

  return { state, card, error, isRefreshing, reload: load };
}
