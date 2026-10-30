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

/** Live view of one line for a rider (student or parent): ETA, delay, map and the stops. */
export function TrackingView({ data }: { data: LiveLine | MyTracking }) {
  const t = useTranslations("tracking");
  const locale = useLocale();
  const { position, nextStop } = useLivePosition(data.line_id, data.position);
  const myStopId = "my_stop_id" in data ? data.my_stop_id : undefined;
  const eta = "eta_minutes" in data ? data.eta_minutes : null;
  const next = nextStop === undefined ? data.next_stop_name : nextStop;
  const myStop = data.stops.find((stop) => stop.id === myStopId);

  return (
    <div className="flex flex-col gap-4">
      <Card raised className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[18px] font-bold">{data.line_name}</h2>
          <Pill tone={data.state === TripState.InProgress ? "teal" : "neutral"} icon={data.state === TripState.InProgress ? <span className="live-dot" aria-hidden /> : undefined}>
            {t(`state.${data.state}`)}
          </Pill>
        </div>
        {data.state === TripState.InProgress && eta !== null && (
          <p className="text-[28px] leading-9 font-extrabold text-teal-text">
            {data.direction === "outbound" ? t("etaToStop", { minutes: eta }) : t("etaToHome", { minutes: eta })}
          </p>
        )}
        {data.state === TripState.NotStarted && myStop && <p className="text-ink">{t("leavesAt", { time: formatClock(myStop.time, locale), stop: myStop.name })}</p>}
        {data.state === TripState.Ended && <p className="text-ink-muted">{t("endedBody")}</p>}
        {data.delay_minutes > 0 && <Banner tone="warning">{t("delayed", { minutes: data.delay_minutes })}</Banner>}
        <dl className="grid grid-cols-2 gap-2 text-[14px]">
          <Info icon={<Bus className="size-4" aria-hidden />} label={t("bus")} value={data.bus_plate} />
          <Info icon={<User className="size-4" aria-hidden />} label={t("driver")} value={data.driver_name} />
          <Info icon={<MapPin className="size-4" aria-hidden />} label={t("nextStop")} value={next} />
          <Info icon={<Clock className="size-4" aria-hidden />} label={t("lastFix")} value={position ? formatTime(position.at, locale) : null} />
        </dl>
      </Card>
      <TrackingMap line={data} position={position} myStopId={myStopId} label={t("mapLabel", { line: data.line_name })} />
      <Card>
        <CardTitle>{t("stops")}</CardTitle>
        <ol className="flex flex-col gap-1">
          {data.stops.map((stop) => (
            <li key={stop.id} className={cn("flex items-center justify-between gap-3 rounded-md px-2 py-2", stop.id === myStopId && "bg-coral-soft")}>
              <span className={cn("flex items-center gap-2", stop.passed && "text-ink-muted line-through decoration-1")}>
                <span aria-hidden className={cn("size-2.5 rounded-full", stop.passed ? "bg-line-strong" : "bg-brand")} />
                {stop.name}
                {stop.id === myStopId && <Pill tone="brand">{t("myStop")}</Pill>}
              </span>
              <span className="num text-[14px] text-ink-muted">{formatClock(stop.time, locale)}</span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

function Info({ icon, label, value, ltr }: { icon: ReactNode; label: string; value: string | null; ltr?: boolean }) {
  return (
    <div className="rounded-md bg-surface-alt p-2">
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
