"use client";

import { BusFront, Gauge, MapPinOff } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Badge, LiveDot } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { Tone } from "@/components/ui/tone";
import { BusDriverDetails } from "@/features/lines/components/bus-driver-card";
import { useDurationLabel } from "@/features/subscriptions/components/use-duration-label";
import { TripStatus } from "@/features/trips/schema";
import type { Locale } from "@/i18n/routing";
import { isMockMode } from "@/lib/config";
import { formatNumber, formatTime } from "@/lib/format";
import { type LiveTrip } from "../schema";
import { BusMap } from "./bus-map";
import { type TrackingAudience } from "./tracking-panel";

const MS_PER_MINUTE = 60_000;

export function LiveTripView({ trip, audience }: { trip: LiveTrip; audience: TrackingAudience }) {
  const t = useTranslations("tracking");
  const tRoot = useTranslations();
  const locale = useLocale() as Locale;
  const durationLabel = useDurationLabel();
  const name = audience.who === "child" ? audience.name : "";
  const time = trip.eta_minutes === null ? "" : durationLabel(trip.eta_minutes * MS_PER_MINUTE);
  const isMoving = trip.status === TripStatus.Approaching || trip.status === TripStatus.PassedStop;
  const position = trip.position;

  return (
    <div className="flex flex-col gap-5">
      <Card elevation="raised">
        <CardBody className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={Tone.Brand}>{tRoot("student.lineCode", { code: trip.line.code })}</Badge>
            <span className="text-body font-bold text-ink-strong">{trip.line.name}</span>
            <span className="text-body-sm text-ink-muted">· {t("toCampus")}</span>
          </div>
          <div
            role="status"
            aria-live="polite"
            className="flex items-start gap-3 rounded-card bg-teal-soft p-3 text-teal-text"
          >
            {isMoving ? (
              <LiveDot className="mt-1.5" />
            ) : (
              <BusFront aria-hidden="true" className="size-5" />
            )}
            <div className="min-w-0">
              <p className="text-body font-bold">
                {t(`status.${trip.status}`, {
                  who: audience.who,
                  name,
                  time,
                  stop: trip.stop.name,
                })}
              </p>
              {trip.near_stop ? (
                <p className="text-caption">{t("nearStop", { stop: trip.near_stop })}</p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-caption text-ink-muted">
            {position ? (
              <span>{t("updated", { time: formatTime(position.recorded_at, locale) })}</span>
            ) : (
              <span>{t("noFix")}</span>
            )}
            {position && isMoving ? (
              <span className="inline-flex items-center gap-1">
                <Gauge aria-hidden="true" className="size-3.5" />
                {t("speed", { speed: formatNumber(position.speed_kmh, locale) })}
              </span>
            ) : null}
          </div>
        </CardBody>
      </Card>

      <BusMap
        bus={position ? { lat: position.lat, lng: position.lng, heading: position.heading } : null}
        trail={trip.trail}
        campus={trip.campus_location}
        stop={trip.stop_location}
        className="h-[22rem] desktop:h-[28rem]"
      />
      <div className="flex flex-col gap-1 text-caption text-ink-muted">
        {trip.stop_location ? null : (
          <p className="flex items-center gap-2">
            <MapPinOff aria-hidden="true" className="size-4 shrink-0" />
            {t("noStopPins")}
          </p>
        )}
        {isMockMode ? <p>{t("demoNote")}</p> : null}
      </div>

      <Card>
        <CardBody>
          <BusDriverDetails bus={trip.bus} />
        </CardBody>
      </Card>
    </div>
  );
}
