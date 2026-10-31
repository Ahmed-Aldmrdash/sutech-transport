"use client";

import { HeartPulse } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Pill, type Tone } from "@/components/ui/Pill";
import { EmptyState } from "@/components/ui/States";
import { formatTime } from "@/lib/time";
import { type Rider, RiderState } from "../schema";

const TONE: Record<RiderState, Tone> = {
  [RiderState.Waiting]: "neutral",
  [RiderState.Boarded]: "success",
  [RiderState.CheckedOut]: "warning",
  [RiderState.Absent]: "danger",
  [RiderState.Skipped]: "brand",
};

/** Riders on the trip, grouped by stop order as the server sends them. */
export function RiderList({ riders }: { riders: Rider[] }) {
  const t = useTranslations("crew.riders");
  const locale = useLocale();
  if (!riders.length) return <EmptyState title={t("empty")} />;
  return (
    <ul className="flex flex-col divide-y divide-line">
      {riders.map((rider) => (
        <li key={rider.student_id} className="flex items-center justify-between gap-3 py-2.5">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 font-bold text-ink-strong">
              {rider.name}
              {rider.priority_seat && (
                <span title={t("priority")} className="text-coral">
                  <HeartPulse className="size-4" aria-label={t("priority")} />
                </span>
              )}
            </p>
            <p className="text-[13px] text-ink-muted">
              <span className="num">{rider.student_id}</span> · {rider.stop_name}
              {rider.detail && rider.state === RiderState.CheckedOut && ` · ${rider.detail}`}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-0.5">
            <Pill tone={TONE[rider.state]}>{t(`state.${rider.state}`)}</Pill>
            {rider.at && <time className="num text-[12px] text-ink-muted">{formatTime(rider.at, locale)}</time>}
          </div>
        </li>
      ))}
    </ul>
  );
}
