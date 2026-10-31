"use client";

import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import { Bus, Clock, MapPin, User } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Banner } from "@/components/ui/Banner";
import { Card, CardTitle } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { formatClock, formatTime } from "@/lib/time";
import { type LiveLine, type MyTracking, TripState } from "../schema";
import { useLivePosition } from "./useLivePosition";

const TrackingMap = dynamic(() => import("./TrackingMap"), { ssr: false, loading: () => <Skeleton className="h-64 sm:h-80" /> });

/**
 * Live view of one line for a rider (student or parent) or the office: ETA, delay, map and the stops.
 * Stacks on narrow screens; when its container is wide (laptop) the map gets its own tall column.
 */
export function TrackingView({ data }: { data: LiveLine | MyTracking }) {
  const t = useTranslations("tracking");
  const locale = useLocale();
  const { position, nextStop } = useLivePosition(data.line_id, data.position);
  const myStopId = "my_stop_id" in data ? data.my_stop_id : undefined;
  const eta = "eta_minutes" in data ? data.eta_minutes : null;
  const next = nextStop === undefined ? data.next_stop_name : nextStop;
  const myStop = data.stops.find((stop) => stop.id === myStopId);
  const live = data.state === TripState.InProgress;
  const currentIndex = data.stops.findIndex((stop) => !stop.passed);

  return (
    <div className="@container">
      <div className="flex flex-col gap-4 @4xl:grid @4xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] @4xl:items-start @4xl:gap-5">
        <div className="@4xl:sticky @4xl:top-24 @4xl:order-last">
          <TrackingMap
            line={data}
            position={position}
            myStopId={myStopId}
            label={t("mapLabel", { line: data.line_name })}
            className="@4xl:h-[560px]"
          />
        </div>

        <div className="flex min-w-0 flex-col gap-4 @4xl:order-first">
          <Card raised className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-[18px] font-bold">{data.line_name}</h2>
              <Pill tone={live ? "teal" : "neutral"} icon={live ? <span className="live-dot" aria-hidden /> : undefined}>
                {t(`state.${data.state}`)}
              </Pill>
            </div>
            {live && eta !== null && (
              <p className="text-[28px] leading-9 font-extrabold text-brand">
                {data.direction === "outbound" ? t("etaToStop", { minutes: eta }) : t("etaToHome", { minutes: eta })}
              </p>
            )}
            {data.state === TripState.NotStarted && myStop && (
              <p className="text-ink">{t("leavesAt", { time: formatClock(myStop.time, locale), stop: myStop.name })}</p>
            )}
            {data.state === TripState.Ended && <p className="text-ink-muted">{t("endedBody")}</p>}
            {data.delay_minutes > 0 && <Banner tone="warning">{t("delayed", { minutes: data.delay_minutes })}</Banner>}
            <dl className="grid grid-cols-2 gap-2 text-[14px]">
              <Info icon={<Bus className="size-4" aria-hidden />} label={t("bus")} value={data.bus_plate} />
              <Info icon={<User className="size-4" aria-hidden />} label={t("driver")} value={data.driver_name} />
              <Info icon={<MapPin className="size-4" aria-hidden />} label={t("nextStop")} value={next} />
              <Info icon={<Clock className="size-4" aria-hidden />} label={t("lastFix")} value={position ? formatTime(position.at, locale) : null} />
            </dl>
          </Card>

          <Card>
            <CardTitle>{t("stops")}</CardTitle>
            <ol className="relative flex flex-col">
              {data.stops.map((stop, index) => {
                const current = live && index === currentIndex;
                const mine = stop.id === myStopId;
                return (
                  <li key={stop.id} className="relative flex items-start justify-between gap-3 ps-8 pb-4 last:pb-0">
                    {index < data.stops.length - 1 && (
                      <span aria-hidden className={cn("absolute start-[7px] top-4 h-full w-0.5", stop.passed ? "bg-teal" : "bg-line-strong")} />
                    )}
                    <span
                      aria-hidden
                      className={cn(
                        "absolute start-0 top-1 size-4 rounded-full border-2",
                        stop.passed && "border-teal bg-teal",
                        current && "border-coral bg-coral ring-4 ring-coral-soft",
                        !stop.passed && !current && "border-line-strong bg-surface-raised",
                      )}
                    />
                    <span className={cn("flex flex-wrap items-center gap-2", stop.passed && "text-ink-muted", current && "font-bold text-ink-strong")}>
                      {stop.name}
                      {mine && <Pill tone="brand">{t("myStop")}</Pill>}
                    </span>
                    <span className="num shrink-0 text-[14px] text-ink-muted">{formatClock(stop.time, locale)}</span>
                  </li>
                );
              })}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Info({ icon, label, value, ltr }: { icon: ReactNode; label: string; value: string | null; ltr?: boolean }) {
  return (
    <div className="rounded-md bg-surface-alt p-2.5">
      <dt className="flex items-center gap-1 text-ink-muted">
        {icon}
        {label}
      </dt>
      <dd className="mt-0.5 truncate font-bold text-ink-strong" dir={ltr ? "ltr" : undefined}>
        {value ?? "—"}
      </dd>
    </div>
  );
}
