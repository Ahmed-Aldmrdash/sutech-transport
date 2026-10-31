"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { QueryState } from "@/lib/api/use-api";
import { PageSkeleton } from "./Skeleton";
import { ErrorState } from "./States";

/** Renders the loading skeleton, the error with a retry, or the data. Every screen goes through this. */
export function Async<T>({
  query,
  children,
  skeleton,
}: {
  query: QueryState<T>;
  children: (data: T) => ReactNode;
  skeleton?: ReactNode;
}) {
  const t = useTranslations("common");
  if (query.data !== undefined) return <>{children(query.data)}</>;
  if (query.error) return <ErrorState error={query.error} onRetry={query.reload} />;
  return <>{skeleton ?? <PageSkeleton label={t("loading")} />}</>;
}
