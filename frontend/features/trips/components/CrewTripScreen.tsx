"use client";

import { ScanLine } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMe } from "@/components/providers/SessionProvider";
import { Async } from "@/components/ui/Async";
import { Banner } from "@/components/ui/Banner";
import { Card, CardTitle } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Role } from "@/features/auth/roles";
import { Link } from "@/i18n/navigation";
import { formatTime } from "@/lib/time";
import { RiderState } from "../schema";
import { RiderList } from "./RiderList";
import { TripControls } from "./TripControls";
import { useCrewTrip } from "./useCrewTrip";

const COUNTED: RiderState[] = [RiderState.Boarded, RiderState.Waiting, RiderState.Skipped, RiderState.CheckedOut, RiderState.Absent];

export function CrewTripScreen() {
  const t = useTranslations("crew.trip");
  const tr = useTranslations("crew.riders");
  const locale = useLocale();
  const me = useMe();
  const query = useCrewTrip();
  const isDriver = me.role === Role.Driver;
  return (
    <Async query={query}>
      {(trip) => (
        <div className="flex flex-col gap-4">
          <Card raised className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h1 className="text-[22px] leading-7 font-extrabold text-ink-strong">{trip.line_name}</h1>
                <p className="text-[14px] text-ink-muted">
                  <bdi>{trip.bus_plate}</bdi> · {trip.driver_name}
                </p>
              </div>
              <Pill tone={trip.state === "in_progress" ? "teal" : "neutral"} icon={trip.state === "in_progress" ? <span className="live-dot" aria-hidden /> : undefined}>
                {t(`state.${trip.state}`)}
              </Pill>
            </div>
            {trip.state !== "not_started" && (
              <p className="text-[14px] text-ink-muted">
                {t(trip.direction)}
                {trip.started_at && ` · ${t("startedAt", { time: formatTime(trip.started_at, locale) })}`}
                {trip.ended_at && ` · ${t("endedAt", { time: formatTime(trip.ended_at, locale) })}`}
              </p>
            )}
            {trip.delay_minutes > 0 && <Banner tone="warning">{t("delay", { minutes: trip.delay_minutes })}</Banner>}
            {isDriver ? <TripControls trip={trip} /> : <Banner tone="info">{t("supervisorNote")}</Banner>}
            {trip.state === "in_progress" && (
              <Link href="/driver/scan" className="label-caps inline-flex min-h-14 items-center justify-center gap-2 rounded-md bg-teal text-[16px] font-bold text-on-teal">
                <ScanLine className="size-5" aria-hidden />
                {t("scan")}
              </Link>
            )}
          </Card>
          <Card>
            <CardTitle>{t("riders", { count: trip.riders.length })}</CardTitle>
            <dl className="mb-3 grid grid-cols-5 gap-1 text-center">
              {COUNTED.map((state) => (
                <div key={state} className="flex flex-col-reverse rounded-md bg-surface-alt px-1 py-2">
                  <dt className="text-[11px] leading-4 text-ink-muted">{tr(`state.${state}`)}</dt>
                  <dd className="num text-[18px] font-extrabold text-ink-strong">{trip.riders.filter((rider) => rider.state === state).length}</dd>
                </div>
              ))}
            </dl>
            <RiderList riders={trip.riders} />
          </Card>
        </div>
      )}
    </Async>
  );
}
