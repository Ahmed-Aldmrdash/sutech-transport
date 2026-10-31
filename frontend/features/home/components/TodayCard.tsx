"use client";

import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { Async } from "@/components/ui/Async";
import { Banner } from "@/components/ui/Banner";
import { Card, CardTitle } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { getMyDay } from "@/features/attendance/api";
import { DayTimeline } from "@/features/attendance/components/DayTimeline";
import { NotGoingCard } from "@/features/attendance/components/NotGoingCard";
import { getMyTracking } from "@/features/tracking/api";
import { TripState } from "@/features/tracking/schema";
import { Link } from "@/i18n/navigation";
import { useApi, usePolling } from "@/lib/api/use-api";

const ETA_REFRESH_MS = 20_000;

/** An active subscriber's day: where the bus is, any delay, "not going today" and what happened so far. */
export function TodayCard() {
  const t = useTranslations("student.day");
  const tt = useTranslations("tracking");
  const tracking = useApi(getMyTracking);
  usePolling(tracking.reload, ETA_REFRESH_MS);
  const day = useApi(getMyDay);
  return (
    <>
      <Card raised>
        <CardTitle
          action={
            <Link href="/student/tracking" className="inline-flex min-h-10 items-center gap-1 text-[14px] font-bold text-brand">
              {t("trackBus")}
              <ArrowLeft className="flip-rtl size-4" aria-hidden />
            </Link>
          }
        >
          {t("busToday")}
        </CardTitle>
        <Async query={tracking} skeleton={<Skeleton className="h-16" />}>
          {(live) => (
            <div className="flex flex-col gap-2">
              {live.state === TripState.InProgress && live.eta_minutes !== null ? (
                <p className="text-[22px] leading-8 font-extrabold text-teal-text">
                  {live.direction === "outbound" ? tt("etaToStop", { minutes: live.eta_minutes }) : tt("etaToHome", { minutes: live.eta_minutes })}
                </p>
              ) : (
                <p className="font-bold text-ink-strong">{tt(`state.${live.state}`)}</p>
              )}
              {live.delay_minutes > 0 && <Banner tone="warning">{tt("delayed", { minutes: live.delay_minutes })}</Banner>}
            </div>
          )}
        </Async>
      </Card>
      <Async query={day} skeleton={<Skeleton className="h-24" />}>
        {(record) => (
          <>
            <NotGoingCard day={record} />
            <Card>
              <CardTitle>{t("timelineTitle")}</CardTitle>
              <DayTimeline events={record.events} emptyText={t("timelineEmpty")} />
            </Card>
          </>
        )}
      </Async>
    </>
  );
}
