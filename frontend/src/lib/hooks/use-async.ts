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
): AsyncState<T> & { reload: () => void; refresh: () => void } {
  const [state, setState] = useState<AsyncState<T>>(LOADING);
  const [attempt, setAttempt] = useState(0);
  const loadRef = useRef(load);
  const isSilentRef = useRef(false);

  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    const controller = new AbortController();
    // A silent refresh keeps the current data on screen until the new answer arrives.
    if (!isSilentRef.current) setState(LOADING);
    isSilentRef.current = false;
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
  /** Loads again without the loading state (polling, background updates). */
  const refresh = useCallback(() => {
    isSilentRef.current = true;
    setAttempt((value) => value + 1);
  }, []);
  return { ...state, reload, refresh };
}
