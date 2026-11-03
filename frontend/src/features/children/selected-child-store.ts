"use client";

import { useSyncExternalStore } from "react";

/** The guardian's last pick, so every parent page opens on the same child. */
const SELECTED_KEY = "sut.parent.child";
const listeners = new Set<() => void>();

function read(): string | null {
  try {
    return localStorage.getItem(SELECTED_KEY);
  } catch {
    return null;
  }
}

export const selectedChildStore = {
  get: read,
  set(studentId: string) {
    if (read() === studentId) return;
    try {
      localStorage.setItem(SELECTED_KEY, studentId);
    } catch {
      // Private mode: the pick only lasts until the page reloads.
    }
    listeners.forEach((listener) => listener());
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function useSelectedChildId(): string | null {
  return useSyncExternalStore(selectedChildStore.subscribe, selectedChildStore.get, () => null);
}
