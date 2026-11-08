"use client";

import { CircleAlert, CircleCheck, LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { ScanAction } from "../schema";
import { type LastResult } from "./scanner";

/** The answer to the last scan, big enough to read at arm's length. */
export function ResultBanner({ result }: { result: LastResult }) {
  const t = useTranslations("crew.scan");
  if (!result) return null;
  if (!result.ok) {
    return (
      <div
        role="alert"
        className="flex items-center gap-3 rounded-card bg-danger-soft p-4 text-danger-text"
      >
        <CircleAlert aria-hidden="true" className="size-7 shrink-0" />
        <p className="text-body font-bold">{result.message}</p>
      </div>
    );
  }
  const { rider } = result;
  const boarded = result.action === ScanAction.Board;
  return (
    <div
      role="status"
      className={cn(
        "flex items-center gap-3 rounded-card p-4",
        boarded ? "bg-success-soft text-success-text" : "bg-warning-soft text-warning-text",
      )}
    >
      {boarded ? (
        <CircleCheck aria-hidden="true" className="size-7 shrink-0" />
      ) : (
        <LogOut aria-hidden="true" className="size-7 shrink-0" />
      )}
      <div className="min-w-0">
        <p className="text-body font-bold">
          {boarded
            ? t("boardedResult", { name: rider.name })
            : t("checkedOutResult", { name: rider.name })}
        </p>
        <p className="text-body-sm">
          <bdi>{rider.identifier}</bdi> · {rider.stop_name}
        </p>
      </div>
    </div>
  );
}
