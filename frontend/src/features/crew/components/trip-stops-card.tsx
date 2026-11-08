"use client";

import { useLocale, useTranslations } from "next-intl";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { TripDirection } from "@/features/trips/schema";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { formatClockTime, formatNumber } from "@/lib/format";
import { RiderState, type CrewToday, type CrewTrip } from "../schema";

/** The line's stops with how many are still to be picked up at each. */
export function StopsCard({ today, trip }: { today: CrewToday; trip: CrewTrip }) {
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
