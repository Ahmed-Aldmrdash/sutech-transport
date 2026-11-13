"use client";

import type { ReactNode } from "react";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { AsyncStatus } from "@/lib/hooks/use-async";

/** Loading rows, the error with retry, or the list itself. */
export function DeskListState<T>({
  state,
  children,
}: {
  state: { status: AsyncStatus; data?: T; error?: unknown; reload: () => void };
  children: (data: T) => ReactNode;
}) {
  if (state.status === AsyncStatus.Loading) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (state.status === AsyncStatus.Error) {
    return <ErrorState error={state.error} onRetry={state.reload} />;
  }
  return <>{children(state.data as T)}</>;
}
