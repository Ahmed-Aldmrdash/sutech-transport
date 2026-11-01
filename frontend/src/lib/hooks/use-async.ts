"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const AsyncStatus = {
  Loading: "loading",
  Success: "success",
  Error: "error",
} as const;
export type AsyncStatus = (typeof AsyncStatus)[keyof typeof AsyncStatus];

export type AsyncState<T> =
  | { status: typeof AsyncStatus.Loading; data: undefined; error: undefined }
  | { status: typeof AsyncStatus.Success; data: T; error: undefined }
  | { status: typeof AsyncStatus.Error; data: undefined; error: unknown };

const LOADING = { status: AsyncStatus.Loading, data: undefined, error: undefined } as const;

/**
 * Runs an async loader on mount and on `reload()`, cancelling stale runs.
 * Every screen shows the three states: loading, error (with retry) and data.
 */
export function useAsync<T>(
  load: (signal: AbortSignal) => Promise<T>,
  deps: readonly unknown[],
): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>(LOADING);
  const [attempt, setAttempt] = useState(0);
  const loadRef = useRef(load);

  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset to loading for each run
    setState(LOADING);
    loadRef.current(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted)
          setState({ status: AsyncStatus.Success, data, error: undefined });
      },
      (error: unknown) => {
        if (!controller.signal.aborted)
          setState({ status: AsyncStatus.Error, data: undefined, error });
      },
    );
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- callers pass their own dependency list
  }, [attempt, ...deps]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  return { ...state, reload };
}
