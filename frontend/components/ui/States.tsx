"use client";

import type { ReactNode } from "react";
import { CloudOff, Inbox } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ApiError } from "@/lib/api/errors";
import { Button } from "./Button";

export function EmptyState({ title, children, icon, action }: { title: string; children?: ReactNode; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-card border border-dashed border-line-strong bg-surface-alt px-4 py-8 text-center">
      <span className="text-ink-muted">{icon ?? <Inbox className="size-8" aria-hidden />}</span>
      <p className="font-bold text-ink-strong">{title}</p>
      {children && <div className="max-w-sm text-[15px] text-ink-muted">{children}</div>}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  const t = useTranslations("common");
  const message = useErrorMessage(error);
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-card border border-danger-soft bg-danger-soft px-4 py-8 text-center">
      <CloudOff className="size-8 text-danger" aria-hidden />
      <p className="font-bold text-ink-strong">{t("errorTitle")}</p>
      <p className="max-w-sm text-[15px] text-ink">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {t("retry")}
        </Button>
      )}
    </div>
  );
}

/** Translates a server error code; unknown codes fall back to a generic sentence. */
export function useErrorMessage(error: ApiError | null | undefined): string {
  const t = useTranslations("errors");
  if (!error) return "";
  return t.has(error.code) ? t(error.code) : t("UNKNOWN");
}
