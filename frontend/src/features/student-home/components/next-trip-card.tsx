"use client";

import { Bus, MapPin } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect } from "react";
import { Badge, LiveDot } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { BusDriverDetails } from "@/features/lines/components/bus-driver-card";
import { ErrorState } from "@/components/ui/error-state";
import { SkeletonLines } from "@/components/ui/skeleton";
import { Tone } from "@/components/ui/tone";
import { getMyNextTrip } from "@/features/trips/api";
import { TripStatus, type NextTrip } from "@/features/trips/schema";
import { useDurationLabel } from "@/features/subscriptions/components/use-duration-label";
import type { Locale } from "@/i18n/routing";
import { formatCalendarDate, formatClockTime, formatTime } from "@/lib/format";
import { AsyncStatus, useAsync } from "@/lib/hooks/use-async";

const MS_PER_MINUTE = 60_000;
/** The home re-reads the bus status this often; the tracking page follows the bus live. */
const REFRESH_MS = 60_000;

/** Tomorrow's (or today's) trip to campus, and where the bus is now. Active subscribers only. */
export function NextTripCard() {
  const t = useTranslations("student.home.trip");
  const state = useAsync((signal) => getMyNextTrip({ signal }), []);
  useRefresh(state.refresh, REFRESH_MS);

  return (
    <Card>
      <CardHeader title={t("title")} />
      <CardBody>
        {state.status === AsyncStatus.Loading ? <SkeletonLines lines={5} /> : null}
        {state.status === AsyncStatus.Error ? (
          <ErrorState error={state.error} onRetry={state.reload} />
        ) : null}
        {state.status === AsyncStatus.Success && state.data.trip ? (
          <TripDetails trip={state.data.trip} />
        ) : null}
      </CardBody>
    </Card>
  );
}

function useRefresh(refresh: () => void, intervalMs: number) {
  useEffect(() => {
    const timer = setInterval(refresh, intervalMs);
    return () => clearInterval(timer);
  }, [refresh, intervalMs]);
}

function TripDetails({ trip }: { trip: NextTrip }) {
  const t = useTranslations("student.home.trip");
  const tStudent = useTranslations("student");
  const locale = useLocale() as Locale;
  const durationLabel = useDurationLabel();
  const isLive = trip.status === TripStatus.Approaching || trip.status === TripStatus.PassedStop;
  const statusText =
    trip.eta_minutes !== null && isLive
      ? t(trip.status, { time: durationLabel(trip.eta_minutes * MS_PER_MINUTE) })
      : t(trip.status, { time: "" });

  const rows = [
    { label: t("date"), value: formatCalendarDate(trip.service_date, locale, "full") },
    {
      label: t("pickupAt", { stop: trip.stop.name }),
      value: trip.stop.pickup_time
        ? formatClockTime(trip.stop.pickup_time, locale)
        : tStudent("toBeAnnounced"),
    },
    {
      label: t("arrival"),
      value: tStudent("arrivalWindow", {
        from: formatClockTime(trip.campus_arrival.from, locale),
        to: formatClockTime(trip.campus_arrival.to, locale),
      }),
    },
    {
      label: t("returnTime"),
      value: trip.return_departure_time
        ? formatClockTime(trip.return_departure_time, locale)
        : tStudent("toBeAnnounced"),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={Tone.Brand}>{tStudent("lineCode", { code: trip.line.code })}</Badge>
        <span className="text-body font-bold text-ink-strong">{trip.line.name}</span>
        <span className="text-body-sm text-ink-muted">· {t("toCampus")}</span>
      </div>

      <div
        role="status"
        className="flex items-start gap-3 rounded-card bg-teal-soft p-3 text-teal-text"
      >
        {isLive ? <LiveDot className="mt-1.5" /> : <Bus aria-hidden="true" className="size-5" />}
        <div className="min-w-0">
          <p className="text-body-sm font-bold">{statusText}</p>
          {trip.near_stop ? (
            <p className="text-caption">{t("nearStop", { stop: trip.near_stop })}</p>
          ) : null}
          {trip.location_updated_at ? (
            <p className="text-caption">
              {t("updated", { time: formatTime(trip.location_updated_at, locale) })}
            </p>
          ) : null}
        </div>
      </div>

      <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="flex flex-col gap-0.5 border-t border-line py-2.5">
            <dt className="text-caption text-ink-muted">{row.label}</dt>
            <dd className="text-body-sm font-bold text-ink-strong">{row.value}</dd>
          </div>
        ))}
      </dl>

      {trip.bus ? <BusDriverDetails bus={trip.bus} /> : null}
      <ButtonLink
        href="/student/tracking"
        variant="secondary"
        size="sm"
        className="self-start"
        iconStart={<MapPin className="size-4" />}
      >
        {t("trackBus")}
      </ButtonLink>
    </div>
  );
}
