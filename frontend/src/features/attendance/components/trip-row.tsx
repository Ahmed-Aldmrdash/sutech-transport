"use client";

import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Tone } from "@/components/ui/tone";
import type { Locale } from "@/i18n/routing";
import { formatCalendarDate, formatTime } from "@/lib/format";
import { TripOutcome, type TripRecord } from "../schema";

const OUTCOME_TONE: Record<TripOutcome, Tone> = {
  [TripOutcome.Rode]: Tone.Success,
  [TripOutcome.Absent]: Tone.Danger,
  [TripOutcome.NotGoing]: Tone.Neutral,
  [TripOutcome.CheckedOut]: Tone.Warning,
};

/** One trip with its scans; also used on the guardian's day page. */
export function TripRow({ item }: { item: TripRecord }) {
  const t = useTranslations("student.myTrips");
  const locale = useLocale() as Locale;
  const time = (iso: string | null) => (iso ? formatTime(iso, locale) : null);
  const details: string[] = [];
  const boarded = time(item.boarded_at);
  const arrived = time(item.arrived_at);
  const left = time(item.checked_out_at);
  if (boarded) details.push(t("boardedAt", { time: boarded }));
  if (arrived) details.push(t("arrivedAt", { time: arrived }));
  if (left) details.push(t("checkedOutAt", { time: left }));

  return (
    <li className="flex flex-col gap-1.5 p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <p className="text-body font-bold text-ink-strong">
          {formatCalendarDate(item.service_date, locale, "full")}
        </p>
        <p className="text-body-sm text-ink">
          {t("lineAndStop", {
            line: item.line.code,
            stop: item.stop_name,
            direction: t(`direction.${item.direction}`),
          })}
        </p>
        {details.length > 0 ? (
          <p className="text-caption text-ink-muted">{details.join(" · ")}</p>
        ) : null}
        {item.checkout_reason ? (
          <p className="text-caption text-ink-muted">
            {t("reason", { reason: item.checkout_reason })}
          </p>
        ) : null}
      </div>
      <Badge tone={OUTCOME_TONE[item.outcome]} className="self-start">
        {t(`outcome.${item.outcome}`)}
      </Badge>
    </li>
  );
}
