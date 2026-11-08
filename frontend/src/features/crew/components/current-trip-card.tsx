"use client";

import { CalendarX2, CircleCheck, Clock, Flag, LogOut, UserX } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Badge, LiveDot } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { Tone } from "@/components/ui/tone";
import { TripDirection } from "@/features/trips/schema";
import type { Locale } from "@/i18n/routing";
import { formatClockTime, formatNumber, formatTime } from "@/lib/format";
import { CrewTripStatus, type CrewToday, type CrewTrip } from "../schema";
import { StartButton, EndButton } from "./trip-buttons";
import { QuickActions } from "./trip-cards";

export const STATUS_TONE: Record<CrewTripStatus, Tone> = {
  [CrewTripStatus.NotStarted]: Tone.Neutral,
  [CrewTripStatus.InProgress]: Tone.Info,
  [CrewTripStatus.Ended]: Tone.Success,
};

export function directionTitle(t: ReturnType<typeof useTranslations>, trip: CrewTrip) {
  return trip.direction === TripDirection.Outbound ? t("outbound") : t("return");
}

export function CurrentTripCard({
  today,
  trip,
  onChanged,
}: {
  today: CrewToday;
  trip: CrewTrip;
  onChanged: () => void;
}) {
  const t = useTranslations("crew.trip");
  const locale = useLocale() as Locale;

  return (
    <Card elevation="raised">
      <CardHeader
        title={directionTitle(t, trip)}
        headingLevel={2}
        actions={<Badge tone={STATUS_TONE[trip.status]}>{t(`status.${trip.status}`)}</Badge>}
      />
      <CardBody className="flex flex-col gap-5">
        {trip.status === CrewTripStatus.NotStarted ? (
          <>
            <p className="flex items-center gap-2 text-body text-ink">
              <Clock aria-hidden="true" className="size-5 shrink-0 text-teal" />
              {trip.departure_time
                ? t("leavesAt", { time: formatClockTime(trip.departure_time, locale) })
                : t("returnTimeUnknown")}
            </p>
            <Counts trip={trip} />
            <StartButton today={today} trip={trip} onChanged={onChanged} />
          </>
        ) : null}

        {trip.status === CrewTripStatus.InProgress && trip.started_at ? (
          <>
            <p
              role="status"
              className="flex items-center gap-3 rounded-card bg-teal-soft p-3 text-body font-bold text-teal-text"
            >
              <LiveDot />
              {t("onTheRoad", { time: formatTime(trip.started_at, locale) })}
            </p>
            <Counts trip={trip} />
            <QuickActions />
            <EndButton trip={trip} onChanged={onChanged} />
          </>
        ) : null}

        {trip.status === CrewTripStatus.Ended && trip.ended_at ? (
          <>
            <p className="flex items-center gap-3 rounded-card bg-success-soft p-3 text-body font-bold text-success-text">
              <Flag aria-hidden="true" className="size-5 shrink-0" />
              {t("endedAt", { time: formatTime(trip.ended_at, locale) })}
            </p>
            <Counts trip={trip} />
            <ButtonLink href="/driver/passengers" variant="secondary" className="self-start">
              {t("seeList")}
            </ButtonLink>
          </>
        ) : null}

        {trip.delays.length > 0 ? (
          <div className="flex flex-col gap-1 border-t border-line pt-3">
            <p className="text-body-sm font-bold text-ink-strong">{t("delaysTitle")}</p>
            <ul className="flex flex-col gap-1 text-body-sm text-ink">
              {trip.delays.map((delay) => (
                <li key={delay.delay_id} className="flex flex-wrap gap-x-2">
                  <span className="font-bold">
                    {t("delayMinutes", { minutes: formatNumber(delay.minutes, locale) })}
                  </span>
                  <span>· {t(`delayReasons.${delay.reason}`)}</span>
                  <span className="text-ink-muted">· {formatTime(delay.reported_at, locale)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

/** Boarded, still waiting, not going and checked out (absent once the trip ended). */
function Counts({ trip }: { trip: CrewTrip }) {
  const t = useTranslations("crew.trip");
  const locale = useLocale() as Locale;
  const { counts } = trip;
  const ended = trip.status === CrewTripStatus.Ended;
  const number = (value: number) => formatNumber(value, locale);
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatTile
        label={t("countBoarded")}
        value={number(counts.boarded)}
        caption={t("ofTotal", { total: number(counts.total) })}
        icon={<CircleCheck />}
      />
      {ended ? (
        <StatTile label={t("countAbsent")} value={number(counts.absent)} icon={<UserX />} />
      ) : (
        <StatTile label={t("countWaiting")} value={number(counts.waiting)} icon={<Clock />} />
      )}
      <StatTile label={t("countNotGoing")} value={number(counts.not_going)} icon={<CalendarX2 />} />
      <StatTile label={t("countCheckedOut")} value={number(counts.checked_out)} icon={<LogOut />} />
    </div>
  );
}
