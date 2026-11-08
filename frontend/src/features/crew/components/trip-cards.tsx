"use client";

import { BusFront, ScanLine, Siren, Timer, Users } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { Locale } from "@/i18n/routing";
import { formatClockTime, formatNumber, formatTime } from "@/lib/format";
import { CrewTripStatus, type CrewToday, type CrewTrip } from "../schema";
import { StartButton } from "./trip-buttons";
import { STATUS_TONE, directionTitle } from "./current-trip-card";

export function QuickActions() {
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

export function OtherTripRow({
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

export function BusCard({ today }: { today: CrewToday }) {
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
