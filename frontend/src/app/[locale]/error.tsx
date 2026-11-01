"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/error-state";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Phase 8 sends this to error monitoring; for now it stays in the console.
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60dvh] max-w-xl items-center px-4 py-10">
      <ErrorState className="w-full" error={error} onRetry={reset} />
    </main>
  );
}
