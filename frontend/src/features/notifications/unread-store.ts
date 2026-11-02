"use client";

import { useSyncExternalStore } from "react";

/**
 * The unread notification count, shared by the bell, the bottom bar and the notifications page,
 * so reading one updates the badge everywhere at once.
 */
let count = 0;
const listeners = new Set<() => void>();

export const unreadStore = {
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

export function useUnreadCount(): number {
  return useSyncExternalStore(unreadStore.subscribe, unreadStore.get, () => 0);
}
