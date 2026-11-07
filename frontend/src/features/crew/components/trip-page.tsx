"use client";

import {
  BusFront,
  CalendarX2,
  CircleCheck,
  Clock,
  Flag,
  LogOut,
  Play,
  ScanLine,
  Siren,
  Timer,
  UserX,
  Users,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge, LiveDot } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { Tone } from "@/components/ui/tone";
import { useToast } from "@/components/ui/toast";
import { SosStatus } from "@/features/sos/schema";
import { TripDirection } from "@/features/trips/schema";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { formatClockTime, formatNumber, formatServiceDay, formatTime } from "@/lib/format";
import { useSubmit } from "@/lib/hooks/use-submit";
import { endTrip, startTrip } from "../api";
import {
  CrewErrorCode,
  CrewTripStatus,
  RiderState,
  type CrewToday,
  type CrewTrip,
} from "../schema";
import { currentTrip, isBlockedByOtherTrip, waitingRiders } from "../trip-rules";
import { CrewGate } from "./crew-gate";

const TRIP_ERRORS = [
  CrewErrorCode.TripAlreadyStarted,
  CrewErrorCode.TripAlreadyEnded,
  CrewErrorCode.TripNotStarted,
  CrewErrorCode.OtherTripInProgress,
] as const;

const STATUS_TONE: Record<CrewTripStatus, Tone> = {
  [CrewTripStatus.NotStarted]: Tone.Neutral,
  [CrewTripStatus.InProgress]: Tone.Info,
  [CrewTripStatus.Ended]: Tone.Success,
};

/** The crew's home: today's bus and trip, start and end, the counts and the quick actions. */
export function TripPage() {
  return <CrewGate>{(today, refresh) => <TripView today={today} refresh={refresh} />}</CrewGate>;
}

function TripView({ today, refresh }: { today: CrewToday; refresh: () => void }) {
  const t = useTranslations("crew.trip");
  const tRoot = useTranslations();
  const locale = useLocale() as Locale;
  const trip = currentTrip(today);
  const others = today.trips.filter((item) => item.trip_id !== trip?.trip_id);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={`${tRoot(`roles.${today.crew_role}`)} · ${formatServiceDay(today.service_date, locale)}`}
        title={t("title")}
        description={`${tRoot("student.lineCode", { code: today.line.code })} · ${today.line.name}`}
      />
      {trip?.sos && trip.sos.status !== SosStatus.Closed ? (
        <Alert
          tone={Tone.Danger}
          title={t("sosOpenTitle")}
          action={
            <ButtonLink href="/driver/sos" variant="danger" size="sm">
              {t("sosOpenAction")}
            </ButtonLink>
          }
        >
          {t(`sosOpenBody.${trip.sos.status}`)}
        </Alert>
      ) : null}
      <div className="grid items-start gap-5 desktop:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-5">
          {trip ? <CurrentTripCard today={today} trip={trip} onChanged={refresh} /> : null}
          {others.length > 0 ? (
            <Card>
              <CardHeader title={t("otherTrips")} headingLevel={2} />
              <CardBody className="flex flex-col gap-3">
                {others.map((item) => (
                  <OtherTripRow key={item.trip_id} today={today} trip={item} onChanged={refresh} />
                ))}
              </CardBody>
            </Card>
          ) : null}
        </div>
        <div className="flex flex-col gap-5">
          <BusCard today={today} />
          {trip ? <StopsCard today={today} trip={trip} /> : null}
        </div>
      </div>
    </div>
  );
}

function directionTitle(t: ReturnType<typeof useTranslations>, trip: CrewTrip) {
  return trip.direction === TripDirection.Outbound ? t("outbound") : t("return");
}

function CurrentTripCard({
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

function QuickActions() {
  const t = useTranslations("crew.trip");
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <ButtonLink
        href="/driver/scan"
        size="lg"
        className="sm:col-span-2"
        iconStart={<ScanLine className="size-5" />}
      >
        {t("scan")}
      </ButtonLink>
      <ButtonLink
        href="/driver/passengers"
        variant="secondary"
        iconStart={<Users className="size-5" />}
      >
        {t("passengers")}
      </ButtonLink>
      <ButtonLink href="/driver/delay" variant="secondary" iconStart={<Timer className="size-5" />}>
        {t("reportDelay")}
      </ButtonLink>
      <ButtonLink
        href="/driver/sos"
        variant="danger"
        className="sm:col-span-2"
        iconStart={<Siren className="size-5" />}
      >
        {t("sos")}
      </ButtonLink>
    </div>
  );
}

function StartButton({
  today,
  trip,
  onChanged,
  compact,
}: {
  today: CrewToday;
  trip: CrewTrip;
  onChanged: () => void;
  compact?: boolean;
}) {
  const t = useTranslations("crew.trip");
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const { submit, isSending, serverError } = useSubmit(TRIP_ERRORS);
  const blocked = isBlockedByOtherTrip(today, trip);

  async function start() {
    const started = await submit((idempotencyKey) => startTrip(trip.trip_id, { idempotencyKey }));
    setConfirming(false);
    if (started) {
      toast.show({ title: t("startedToast"), tone: Tone.Success });
      onChanged();
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        size={compact ? "sm" : "lg"}
        variant={compact ? "secondary" : "primary"}
        withArrow={!compact}
        className="self-start"
        disabled={blocked}
        iconStart={compact ? <Play className="size-4" /> : undefined}
        onClick={() => setConfirming(true)}
      >
        {trip.direction === TripDirection.Outbound ? t("startOutbound") : t("startReturn")}
      </Button>
      {blocked ? <p className="text-caption text-ink-muted">{t("blocked")}</p> : null}
      {serverError ? <Alert tone={Tone.Danger} title={t(`errors.${serverError}`)} /> : null}
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => void start()}
        isConfirming={isSending}
        title={
          trip.direction === TripDirection.Outbound
            ? t("startOutboundConfirm")
            : t("startReturnConfirm")
        }
        description={t("startConfirmBody")}
        confirmLabel={t("startConfirm")}
      />
    </div>
  );
}

function EndButton({ trip, onChanged }: { trip: CrewTrip; onChanged: () => void }) {
  const t = useTranslations("crew.trip");
  const locale = useLocale() as Locale;
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const { submit, isSending, serverError } = useSubmit(TRIP_ERRORS);
  const waiting = waitingRiders(trip).length;

  async function end() {
    const ended = await submit((idempotencyKey) => endTrip(trip.trip_id, { idempotencyKey }));
    setConfirming(false);
    if (ended) {
      toast.show({ title: t("endedToast"), tone: Tone.Success });
      onChanged();
    }
  }

  return (
    <div className="flex flex-col gap-2 border-t border-line pt-4">
      <Button
        variant="secondary"
        className="self-start"
        iconStart={<Flag className="size-4" />}
        onClick={() => setConfirming(true)}
      >
        {trip.direction === TripDirection.Outbound ? t("endOutbound") : t("endReturn")}
      </Button>
      {serverError ? <Alert tone={Tone.Danger} title={t(`errors.${serverError}`)} /> : null}
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => void end()}
        isConfirming={isSending}
        title={t("endConfirm")}
        description={
          waiting > 0
            ? t("endConfirmWaiting", { count: waiting, number: formatNumber(waiting, locale) })
            : t("endConfirmAll")
        }
        confirmLabel={t("endConfirmButton")}
      />
    </div>
  );
}

function OtherTripRow({
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
  let detail = "";
  if (trip.status === CrewTripStatus.Ended && trip.ended_at) {
    detail = t("endedAt", { time: formatTime(trip.ended_at, locale) });
  } else if (trip.departure_time) {
    detail = t("leavesAt", { time: formatClockTime(trip.departure_time, locale) });
  } else {
    detail = t("returnTimeUnknown");
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line p-3">
      <div className="min-w-0">
        <p className="text-body font-bold text-ink-strong">{directionTitle(t, trip)}</p>
        <p className="text-body-sm text-ink-muted">{detail}</p>
      </div>
      {trip.status === CrewTripStatus.NotStarted ? (
        <StartButton today={today} trip={trip} onChanged={onChanged} compact />
      ) : (
        <Badge tone={STATUS_TONE[trip.status]}>{t(`status.${trip.status}`)}</Badge>
      )}
    </div>
  );
}

function BusCard({ today }: { today: CrewToday }) {
  const t = useTranslations("crew.trip");
  const tRoot = useTranslations();
  const locale = useLocale() as Locale;
  return (
    <Card>
      <CardHeader title={t("busTitle")} headingLevel={2} />
      <CardBody>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-body-sm">
          <div>
            <dt className="text-caption text-ink-muted">{t("plate")}</dt>
            <dd className="flex items-center gap-2 font-bold text-ink-strong">
              <BusFront aria-hidden="true" className="size-4 text-teal" />
              <bdi className="whitespace-nowrap">{today.bus.plate}</bdi>
            </dd>
          </div>
          <div>
            <dt className="text-caption text-ink-muted">{t("busType")}</dt>
            <dd className="font-bold text-ink-strong">
              {tRoot(`student.busType.${today.bus.bus_type}`)}
            </dd>
          </div>
          <div>
            <dt className="text-caption text-ink-muted">{t("seats")}</dt>
            <dd className="font-bold text-ink-strong">{formatNumber(today.bus.seats, locale)}</dd>
          </div>
          <div>
            <dt className="text-caption text-ink-muted">{t("campus")}</dt>
            <dd className="font-bold text-ink-strong">
              {tRoot("student.arrivalWindow", {
                from: formatClockTime(today.campus_arrival.from, locale),
                to: formatClockTime(today.campus_arrival.to, locale),
              })}
            </dd>
          </div>
        </dl>
      </CardBody>
    </Card>
  );
}

/** The line's stops with how many are still to be picked up at each. */
function StopsCard({ today, trip }: { today: CrewToday; trip: CrewTrip }) {
  const t = useTranslations("crew.trip");
  const locale = useLocale() as Locale;
  const waitingAt = (order: number) =>
    trip.riders.filter((rider) => rider.stop_order === order && rider.state === RiderState.Waiting)
      .length;
  const outbound = trip.direction === TripDirection.Outbound;

  return (
    <Card>
      <CardHeader
        title={t("stopsTitle")}
        description={outbound ? t("stopsLead") : t("stopsLeadReturn")}
        headingLevel={2}
      />
      <CardBody>
        <ol className="flex flex-col">
          {today.stops.map((stop) => {
            const waiting = waitingAt(stop.order);
            return (
              <li
                key={stop.order}
                className="flex items-center gap-3 border-t border-line py-2.5 first:border-t-0"
              >
                <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-caption font-bold text-brand">
                  {formatNumber(stop.order, locale)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-body-sm font-bold text-ink-strong">{stop.name}</p>
                  {outbound && stop.pickup_time ? (
                    <p className="text-caption text-ink-muted">
                      {formatClockTime(stop.pickup_time, locale)}
                    </p>
                  ) : null}
                </div>
                <span
                  className={cn(
                    "shrink-0 text-caption",
                    waiting > 0 ? "font-bold text-ink-strong" : "text-ink-muted",
                  )}
                >
                  {t("toPickUp", { count: waiting, number: formatNumber(waiting, locale) })}
                </span>
              </li>
            );
          })}
        </ol>
      </CardBody>
    </Card>
  );
}
