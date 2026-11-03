"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { SubscriptionStatus } from "@/features/subscriptions/schema";
import { usePathname } from "@/i18n/navigation";
import { AsyncStatus, useAsync } from "@/lib/hooks/use-async";
import { listChildren } from "../api";
import { selectedChildStore, useSelectedChildId } from "../selected-child-store";
import type { Child } from "../schema";

/** A notification can open a page for one child: /parent/day?child=usr_… */
export const CHILD_QUERY_PARAM = "child";

interface ChildrenContextValue {
  children: readonly Child[];
  selected: Child | null;
  select: (studentId: string) => void;
  /** Re-reads the list quietly (after a booking changes, for example). */
  refresh: () => void;
}

const ChildrenContext = createContext<ChildrenContextValue | null>(null);

/**
 * Loads the guardian's children once for all parent pages and remembers which one is shown.
 * Switching language or page keeps the list: no reload, no loader.
 */
export function ChildrenProvider({ children: content }: { children: ReactNode }) {
  const state = useAsync((signal) => listChildren({ signal }), []);
  const selectedId = useSelectedChildId();
  const pathname = usePathname();

  useEffect(() => {
    // A notification's link names the child: it becomes the pick on arrival.
    const fromUrl = new URLSearchParams(window.location.search).get(CHILD_QUERY_PARAM);
    if (fromUrl) selectedChildStore.set(fromUrl);
  }, [pathname]);

  if (state.status === AsyncStatus.Loading) {
    return (
      <div className="flex flex-col gap-5">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (state.status === AsyncStatus.Error) {
    return <ErrorState error={state.error} onRetry={state.reload} />;
  }

  const list = state.data.children;
  // First visit: open on a child who rides the bus, if any.
  const selected =
    list.find((child) => child.student_id === selectedId) ??
    list.find((child) => child.subscription?.status === SubscriptionStatus.Active) ??
    list[0] ??
    null;
  return (
    <ChildrenContext.Provider
      value={{ children: list, selected, select: selectedChildStore.set, refresh: state.refresh }}
    >
      {content}
    </ChildrenContext.Provider>
  );
}

export function useChildren(): ChildrenContextValue {
  const value = useContext(ChildrenContext);
  if (!value) throw new Error("useChildren must be used inside ChildrenProvider");
  return value;
}
