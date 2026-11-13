"use client";

import { useEffect, useSyncExternalStore } from "react";
import { listGuardianApprovals } from "./api";
import { RequestStatus } from "./schema";

/**
 * How many of the children's requests wait for the guardian's answer: the badge on the
 * guardian's "Approvals" tab. Shared, so answering one updates the badge at once.
 */
let count = 0;
const listeners = new Set<() => void>();

const awaitingStore = {
  get: () => count,
  set(next: number) {
    if (next === count) return;
    count = next;
    listeners.forEach((listener) => listener());
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

/** Re-counts from the server; the approvals page calls it after an answer. */
export function refreshAwaitingApprovals(signal?: AbortSignal): void {
  listGuardianApprovals({ signal }).then(
    ({ approvals }) =>
      awaitingStore.set(
        approvals.filter((item) => item.request.status === RequestStatus.AwaitingGuardian).length,
      ),
    () => undefined, // The badge keeps its last value; the page shows errors.
  );
}

const POLL_MS = 60_000;

/** The badge count, kept current on mount, every minute and when the app comes back. */
export function useAwaitingApprovals(enabled: boolean): number {
  useEffect(() => {
    if (!enabled) return;
    let controller = new AbortController();
    const check = () => {
      controller.abort();
      controller = new AbortController();
      refreshAwaitingApprovals(controller.signal);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    check();
    const timer = window.setInterval(check, POLL_MS);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled]);
  const value = useSyncExternalStore(awaitingStore.subscribe, awaitingStore.get, () => 0);
  return enabled ? value : 0;
}
