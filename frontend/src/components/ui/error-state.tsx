"use client";

import { CloudOff, RotateCw, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { ClientErrorCode, ServerErrorCode, isApiError } from "@/lib/api/errors";
import { cn } from "@/lib/cn";
import { Button } from "./button";

type ErrorKind = "network" | "forbidden" | "notFound" | "generic";

function classify(error: unknown): ErrorKind {
  if (!isApiError(error)) return "generic";
  if (error.code === ClientErrorCode.Network || error.code === ClientErrorCode.Timeout)
    return "network";
  if (error.code === ServerErrorCode.Forbidden) return "forbidden";
  if (error.code === ServerErrorCode.NotFound) return "notFound";
  return "generic";
}

interface ErrorStateProps {
  /** The thrown error; its code picks the message. */
  error?: unknown;
  /** Pick the message directly (for errors that can't be passed from a server component). */
  kind?: ErrorKind;
  onRetry?: () => void;
  className?: string;
}

/** What every screen shows when loading fails: what happened, and a way to try again. */
export function ErrorState({ error, kind: kindProp, onRetry, className }: ErrorStateProps) {
  const t = useTranslations("errors");
  const kind = kindProp ?? classify(error);

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center rounded-card border border-line bg-surface-raised px-6 py-10 text-center",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="mb-4 inline-flex size-14 items-center justify-center rounded-card bg-danger-soft text-danger-text [&_svg]:size-7"
      >
        {kind === "network" ? <CloudOff /> : <TriangleAlert />}
      </span>
      <h2 className="text-h3 text-ink-strong">{t(`${kind}.title`)}</h2>
      <p className="mt-1 max-w-md text-body-sm text-ink-muted">{t(`${kind}.description`)}</p>
      {onRetry ? (
        <Button
          variant="secondary"
          className="mt-5"
          iconStart={<RotateCw className="size-4" />}
          onClick={onRetry}
        >
          {t("retry")}
        </Button>
      ) : null}
    </div>
  );
}
