"use client";

import { Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useNow } from "@/lib/hooks/use-now";
import { useDurationLabel } from "./use-duration-label";

const TICK_MS = 15_000;

/** "Hold ends in 23 h 10 min", ticking. Calls onEnded once when the hold runs out. */
export function HoldCountdown({ endsAt, onEnded }: { endsAt: string; onEnded?: () => void }) {
  const t = useTranslations("student.home.subscription");
  const now = useNow(TICK_MS);
  const durationLabel = useDurationLabel();
  const left = Date.parse(endsAt) - now;
  const hasEnded = left <= 0;
  useEffect(() => {
    if (hasEnded) onEnded?.();
  }, [hasEnded, onEnded]);
  return (
    <p className="flex items-center gap-2 text-body-sm font-bold text-warning-text">
      <Clock aria-hidden="true" className="size-4 shrink-0" />
      <span role="timer">{t("holdEndsIn", { time: durationLabel(left) })}</span>
    </p>
  );
}
