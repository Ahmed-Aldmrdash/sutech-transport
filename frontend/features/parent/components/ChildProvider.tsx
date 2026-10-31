"use client";

import { type ReactNode, createContext, useContext, useEffect, useMemo, useState } from "react";
import { useApi, type QueryState } from "@/lib/api/use-api";
import { listChildren } from "../api";
import type { Child } from "../schema";

const STORAGE_KEY = "sutech.parent.child";

interface ChildContextValue {
  query: QueryState<Child[]>;
  selected: Child | undefined;
  select: (studentId: string) => void;
}

const ChildContext = createContext<ChildContextValue | null>(null);

function readStored(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** The parent's children and which one the screens show. The choice is remembered on this device. */
export function ChildProvider({ children }: { children: ReactNode }) {
  const query = useApi(listChildren);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    setSelectedId(readStored());
  }, []);

  const value = useMemo<ChildContextValue>(() => {
    const list = query.data ?? [];
    const selected = list.find((child) => child.student_id === selectedId) ?? list[0];
    return {
      query,
      selected,
      select: (studentId) => {
        setSelectedId(studentId);
        try {
          window.localStorage.setItem(STORAGE_KEY, studentId);
        } catch {
          // Private mode: the choice just isn't remembered.
        }
      },
    };
  }, [query, selectedId]);

  return <ChildContext.Provider value={value}>{children}</ChildContext.Provider>;
}

export function useChildren(): ChildContextValue {
  const value = useContext(ChildContext);
  if (!value) throw new Error("useChildren outside ChildProvider");
  return value;
}
