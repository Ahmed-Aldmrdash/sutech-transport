"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ApiError, toApiError } from "./errors";

/* A tiny data layer: every query re-runs after any successful mutation (or a live event that calls invalidate). */
const listeners = new Set<() => void>();
let version = 0;

export function invalidate(): void {
  version += 1;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export interface QueryState<T> {
  data: T | undefined;
  error: ApiError | null;
  loading: boolean;
  reload: () => void;
}

export function useApi<T>(fetcher: () => Promise<T>, deps: readonly unknown[] = []): QueryState<T> {
  const dataVersion = useSyncExternalStore(subscribe, () => version, () => 0);
  const [data, setData] = useState<T>();
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetcherRef
      .current()
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(toApiError(caught));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataVersion, attempt, ...deps]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  return { data, error, loading: loading && data === undefined, reload };
}

export interface MutationState<TArgs extends unknown[], TResult> {
  run: (...args: TArgs) => Promise<TResult | undefined>;
  pending: boolean;
  error: ApiError | null;
  reset: () => void;
}

/** Runs a write; on success refreshes every query. Errors are kept for the form to show, never thrown. */
export function useMutation<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
): MutationState<TArgs, TResult> {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const busy = useRef(false);

  const run = useCallback(
    async (...args: TArgs) => {
      if (busy.current) return undefined;
      busy.current = true;
      setPending(true);
      setError(null);
      try {
        const result = await action(...args);
        invalidate();
        return result;
      } catch (caught) {
        setError(toApiError(caught));
        return undefined;
      } finally {
        busy.current = false;
        setPending(false);
      }
    },
    [action],
  );

  return { run, pending, error, reset: useCallback(() => setError(null), []) };
}

/** Two queries as one, so a screen shows a single skeleton or error for both. */
export function combineQueries<A, B>(a: QueryState<A>, b: QueryState<B>): QueryState<[A, B]> {
  return {
    data: a.data !== undefined && b.data !== undefined ? [a.data, b.data] : undefined,
    error: a.error ?? b.error,
    loading: a.loading || b.loading,
    reload: () => {
      a.reload();
      b.reload();
    },
  };
}

/** Re-reads a query every `ms` while the screen is open (ETAs between live events). */
export function usePolling(reload: () => void, ms: number): void {
  useEffect(() => {
    const id = setInterval(reload, ms);
    return () => clearInterval(id);
  }, [reload, ms]);
}
