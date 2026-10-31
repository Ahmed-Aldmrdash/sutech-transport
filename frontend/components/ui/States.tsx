"use client";

import type { ReactNode } from "react";
import { CloudOff, Inbox } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ApiError } from "@/lib/api/errors";
import { Button } from "./Button";

export function EmptyState({ title, children, icon, action }: { title: string; children?: ReactNode; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-card border border-line bg-surface-raised px-5 py-10 text-center">
      <span className="mb-2 grid size-24 place-items-center rounded-full bg-brand-soft text-brand [&_svg]:size-10 [&_svg]:stroke-[1.75]">
        {icon ?? <Inbox aria-hidden />}
      </span>
      <p className="text-[20px] leading-7 font-extrabold text-ink-strong">{title}</p>
      {children && <div className="max-w-sm text-[15px] text-ink-muted">{children}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  const t = useTranslations("common");
  const message = useErrorMessage(error);
  return (
    <div role="alert" className="flex flex-col items-center gap-2 rounded-card border border-line bg-surface-raised px-5 py-10 text-center">
      <span className="mb-2 grid size-24 place-items-center rounded-full bg-danger-soft text-danger">
        <CloudOff className="size-10 stroke-[1.75]" aria-hidden />
      </span>
      <p className="text-[20px] leading-7 font-extrabold text-ink-strong">{t("errorTitle")}</p>
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
