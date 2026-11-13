"use client";

import { BusFront, CalendarX, ShieldAlert, Siren, Timer, UserCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, type ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { TextField } from "@/components/ui/input";
import { StatTile } from "@/components/ui/stat-tile";
import { Tone } from "@/components/ui/tone";
import { TestDayButton } from "@/features/crew/components/test-day-button";
import { DeskListState } from "@/features/desk-kit/components/desk-list-state";
import type { Locale } from "@/i18n/routing";
import {
  addCalendarDays,
  formatCalendarDate,
  formatNumber,
  formatServiceDay,
  formatTime,
  todayInCairo,
} from "@/lib/format";
import { useAsync } from "@/lib/hooks/use-async";
import { SG_DAYS_BACK_MAX, type SgOverview } from "../schema";
import { SgEmergencies, SgEvents } from "./sg-side-cards";
import { SgLinesTable } from "./sg-lines-table";

/** Today's numbers move while the buses run: read them again every 30 seconds. */
const REFRESH_MS = 30_000;

interface DayOverviewProps<T extends SgOverview> {
  date: string;
  onDateChange: (date: string) => void;
  load: (date: string, signal: AbortSignal) => Promise<T>;
  /** Shown above the day's numbers (the Transportation office's queues). */
  top?: (day: T) => ReactNode;
  /** Where a line in the table links to, if anywhere. */
  lineHref?: (lineId: string) => string;
}

/**
 * One day at a glance, today or up to a month back: riders, lines on the road and late,
 * every line, the day's emergencies and event buses. The Secretary General's page and the
 * Transportation office's home share it.
 */
export function DayOverview<T extends SgOverview>({
  date,
  onDateChange,
  load,
  top,
  lineHref,
}: DayOverviewProps<T>) {
  const t = useTranslations("desk.sg");
  const locale = useLocale() as Locale;
  const today = todayInCairo();
  const isToday = date === today;
  const state = useAsync((signal) => load(date, signal), [date]);
  const { refresh } = state;

  useEffect(() => {
    if (!isToday) return;
    const timer = window.setInterval(refresh, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [isToday, refresh]);

  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
        <TextField
          type="date"
          label={t("day")}
          min={addCalendarDays(today, -SG_DAYS_BACK_MAX)}
          max={today}
          value={date}
          containerClassName="w-full max-w-xs"
          onChange={(event) => {
            const value = event.target.value;
            if (value) onDateChange(value > today ? today : value);
          }}
        />
        {isToday ? null : (
          <Button variant="secondary" onClick={() => onDateChange(today)}>
            {t("backToToday")}
          </Button>
        )}
      </div>
      <DeskListState state={state}>
        {(day: T) => (
          <div className="flex flex-col gap-6">
            <p className="text-caption text-ink-muted" aria-live="polite">
              {day.is_today
                ? t("updatedAt", { time: formatTime(day.generated_at, locale) })
                : t("pastDay", { date: formatCalendarDate(day.date, locale, "full") })}
            </p>
            {top?.(day)}
            {day.is_service_day ? (
              <>
                <Numbers day={day} />
                <SgLinesTable lines={day.lines} lineHref={lineHref} />
              </>
            ) : (
              <EmptyState
                icon={<CalendarX />}
                title={t("noService")}
                description={t("noServiceBody")}
                action={
                  day.is_today ? (
                    <div className="flex flex-wrap justify-center gap-3">
                      {day.previous_service_day ? (
                        <Button
                          variant="secondary"
                          onClick={() => onDateChange(day.previous_service_day ?? today)}
                        >
                          {t("showDay", {
                            date: formatServiceDay(day.previous_service_day, locale),
                          })}
                        </Button>
                      ) : null}
                      <TestDayButton onStarted={state.reload} />
                    </div>
                  ) : day.previous_service_day ? (
                    <Button
                      variant="secondary"
                      onClick={() => onDateChange(day.previous_service_day ?? today)}
                    >
                      {t("showDay", {
                        date: formatServiceDay(day.previous_service_day, locale),
                      })}
                    </Button>
                  ) : null
                }
              />
            )}
            <div className="grid items-start gap-5 desktop:grid-cols-2">
              <SgEmergencies items={day.emergencies} />
              <SgEvents items={day.events} />
            </div>
          </div>
        )}
      </DeskListState>
    </>
  );
}

function Numbers({ day }: { day: SgOverview }) {
  const t = useTranslations("desk.sg.numbers");
  const locale = useLocale() as Locale;
  const number = (value: number) => formatNumber(value, locale);
  const { totals } = day;
  const openEmergencies = day.emergencies.filter((item) => item.status !== "closed").length;
  return (
    <>
      {openEmergencies > 0 ? (
        <Alert
          tone={Tone.Danger}
          title={t("openEmergencies", { count: number(openEmergencies) })}
        />
      ) : null}
      <div className="grid grid-cols-2 gap-3 desktop:grid-cols-5">
        <StatTile
          label={t("rode")}
          value={number(totals.rode)}
          caption={t("ofSubscribers", { count: number(totals.subscribers) })}
          icon={<UserCheck />}
        />
        <StatTile
          label={t("running")}
          value={number(totals.lines_running)}
          caption={t("ofLines", { count: number(totals.lines) })}
          icon={<BusFront />}
        />
        <StatTile
          label={t("delayed")}
          value={number(totals.lines_delayed)}
          caption={totals.lines_delayed ? t("delayedCaption") : t("onTime")}
          icon={<Timer />}
        />
        <StatTile
          label={t("absent")}
          value={number(totals.absent)}
          caption={t("notGoing", { count: number(totals.not_going) })}
          icon={<Siren />}
        />
        <StatTile
          label={t("violations")}
          value={number(day.violations_new)}
          caption={t("violationsCaption")}
          icon={<ShieldAlert />}
          className="col-span-2 desktop:col-span-1"
        />
      </div>
    </>
  );
}
