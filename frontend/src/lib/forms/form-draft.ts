"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

/**
 * Half-typed forms survive a language switch (the page re-renders in the other language) and a
 * reload. Text goes to sessionStorage (this tab only, gone when it closes); chosen files can't
 * be saved there, so they stay in memory, which a language switch keeps. Signing out forgets
 * every draft (see clearPersonalData).
 */
const STORAGE_PREFIX = "sut.draft.";
const inMemory = new Map<string, unknown>();

function readStored<V>(key: string): Partial<V> | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_PREFIX + key);
    return raw ? (JSON.parse(raw) as Partial<V>) : null;
  } catch {
    return null;
  }
}

/** Files and lists of files are kept out of storage (they can't be serialised). */
function storable(values: object): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => {
      if (typeof File !== "undefined" && value instanceof File) return false;
      if (Array.isArray(value) && value.some((item) => item instanceof File)) return false;
      return true;
    }),
  );
}

/**
 * `useState` for a form's values that keeps a draft under `key`. Call `clear()` once the form
 * is sent, so the next visit starts empty.
 */
export function useFormDraft<V extends object>(
  key: string,
  initial: V | (() => V),
): [V, Dispatch<SetStateAction<V>>, () => void] {
  const [values, setValues] = useState<V>(() => {
    const base = typeof initial === "function" ? (initial as () => V)() : initial;
    const kept = inMemory.get(key) as V | undefined;
    if (kept) return kept;
    if (typeof window === "undefined") return base;
    const stored = readStored<V>(key);
    return stored ? { ...base, ...stored } : base;
  });
  useEffect(() => {
    inMemory.set(key, values);
    try {
      window.sessionStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(storable(values)));
    } catch {
      // Blocked storage: the in-memory draft still covers a language switch.
    }
  }, [key, values]);

  function clear() {
    inMemory.delete(key);
    try {
      window.sessionStorage.removeItem(STORAGE_PREFIX + key);
    } catch {
      // Nothing was saved.
    }
  }

  return [values, setValues, clear];
}

/** Forgets every draft kept in memory (signing out). Stored ones go with the "sut." keys. */
export function forgetFormDrafts(): void {
  inMemory.clear();
}
