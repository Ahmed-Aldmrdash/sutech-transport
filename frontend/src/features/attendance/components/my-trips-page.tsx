"use client";

import { BusFront, CalendarCheck, CalendarX2, LogOut, UserX } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { FilterChips } from "@/components/ui/filter-chips";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { StatTile } from "@/components/ui/stat-tile";
import { Tone } from "@/components/ui/tone";
import type { Locale } from "@/i18n/routing";
import { formatCalendarDate, formatNumber, formatTime } from "@/lib/format";
import { AsyncStatus, useAsync } from "@/lib/hooks/use-async";
import { getMyAttendance } from "../api";
import { TRIP_OUTCOMES, TripOutcome, type TripRecord } from "../schema";

const PAGE_SIZE = 20;
const ALL = "all";
type OutcomeFilter = TripOutcome | typeof ALL;

const OUTCOME_TONE: Record<TripOutcome, Tone> = {
  [TripOutcome.Rode]: Tone.Success,
  [TripOutcome.Absent]: Tone.Danger,
  [TripOutcome.NotGoing]: Tone.Neutral,
  [TripOutcome.CheckedOut]: Tone.Warning,
};

/** "My trips": every trip this term with its scans, absences and check-outs. */
export function MyTripsPage() {
  const t = useTranslations("student.myTrips");
  const locale = useLocale() as Locale;
  const [outcome, setOutcome] = useState<OutcomeFilter>(ALL);
  const [pages, setPages] = useState(1);
  const state = useAsync(
    async (signal) => {
      const loaded = await Promise.all(
        Array.from({ length: pages }, (_, index) =>
          getMyAttendance(
            {
              outcome: outcome === ALL ? undefined : outcome,
              page: index + 1,
              page_size: PAGE_SIZE,
            },
            { signal },
          ),
        ),
      );
      const last = loaded.at(-1);
      return {
        items: loaded.flatMap((page) => page.items),
        total: last?.total ?? 0,
        summary: last?.summary ?? { rode: 0, absent: 0, not_going: 0, checked_out: 0 },
      };
    },
    [outcome, pages],
  );

  const neverRode =
    state.status === AsyncStatus.Success &&
    Object.values(state.data.summary).every((count) => count === 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("lead")} />
      {state.status === AsyncStatus.Loading ? <Skeleton className="h-96 w-full" /> : null}
      {state.status === AsyncStatus.Error ? (
        <ErrorState error={state.error} onRetry={state.reload} />
      ) : null}
      {neverRode ? (
        <EmptyState
          icon={<BusFront />}
          title={t("emptyTitle")}
          description={t("emptyBody")}
          action={<ButtonLink href="/student/lines">{t("goLines")}</ButtonLink>}
        />
      ) : null}
      {state.status === AsyncStatus.Success && !neverRode ? (
        <>
          <div className="grid grid-cols-2 gap-3 desktop:grid-cols-4">
            <StatTile
              icon={<CalendarCheck />}
              label={t("summary.rode")}
              value={formatNumber(state.data.summary.rode, locale)}
            />
            <StatTile
              icon={<UserX />}
              label={t("summary.absent")}
              value={formatNumber(state.data.summary.absent, locale)}
            />
            <StatTile
              icon={<CalendarX2 />}
              label={t("summary.not_going")}
              value={formatNumber(state.data.summary.not_going, locale)}
            />
            <StatTile
              icon={<LogOut />}
              label={t("summary.checked_out")}
              value={formatNumber(state.data.summary.checked_out, locale)}
            />
          </div>
          <FilterChips
            label={t("filterLabel")}
            value={outcome}
            onChange={(next) => {
              setOutcome(next);
              setPages(1);
            }}
            options={[
              { value: ALL, label: t("all") },
              ...TRIP_OUTCOMES.map((value) => ({ value, label: t(`outcome.${value}`) })),
            ]}
          />
          {state.data.items.length === 0 ? (
            <p className="text-body-sm text-ink-muted">{t("noneForFilter")}</p>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface-raised">
              {state.data.items.map((item) => (
                <TripRow key={item.trip_id} item={item} />
              ))}
            </ul>
          )}
          {state.data.total > state.data.items.length ? (
            <Button variant="secondary" className="self-center" onClick={() => setPages(pages + 1)}>
              {t("loadMore")}
            </Button>
          ) : null}
          <p className="text-caption text-ink-muted">{t("returnNote")}</p>
        </>
      ) : null}
    </div>
  );
}

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
