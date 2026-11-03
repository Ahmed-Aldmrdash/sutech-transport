"use client";

import {
  BusFront,
  CalendarOff,
  CalendarX2,
  CircleCheck,
  Clock,
  LogOut,
  School,
  UserX,
  type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { LiveDot } from "@/components/ui/badge";
import { firstNameOf } from "@/features/auth/user-text";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { formatClockTime, formatTime } from "@/lib/format";
import { ChildDayStatus, DayEventKind, type ChildDay, type DayEvent } from "../schema";

const STATUS_ICON: Record<ChildDayStatus, LucideIcon> = {
  [ChildDayStatus.NoSubscription]: CalendarX2,
  [ChildDayStatus.NoService]: CalendarOff,
  [ChildDayStatus.NotGoing]: CalendarX2,
  [ChildDayStatus.Waiting]: Clock,
  [ChildDayStatus.BusOnWay]: BusFront,
  [ChildDayStatus.Boarded]: BusFront,
  [ChildDayStatus.Arrived]: School,
  [ChildDayStatus.CheckedOut]: LogOut,
  [ChildDayStatus.Absent]: UserX,
};

/** Colour follows meaning; the words always say it too. */
const STATUS_STYLE: Record<ChildDayStatus, string> = {
  [ChildDayStatus.NoSubscription]: "bg-surface-alt text-ink",
  [ChildDayStatus.NoService]: "bg-surface-alt text-ink",
  [ChildDayStatus.NotGoing]: "bg-surface-alt text-ink",
  [ChildDayStatus.Waiting]: "bg-teal-soft text-teal-text",
  [ChildDayStatus.BusOnWay]: "bg-teal-soft text-teal-text",
  [ChildDayStatus.Boarded]: "bg-teal-soft text-teal-text",
  [ChildDayStatus.Arrived]: "bg-success-soft text-success-text",
  [ChildDayStatus.CheckedOut]: "bg-warning-soft text-warning-text",
  [ChildDayStatus.Absent]: "bg-danger-soft text-danger",
};

const LIVE_STATUSES: readonly ChildDayStatus[] = [ChildDayStatus.BusOnWay, ChildDayStatus.Boarded];

const EVENT_ICON: Record<DayEventKind, LucideIcon> = {
  [DayEventKind.NotGoing]: CalendarX2,
  [DayEventKind.BusLeft]: BusFront,
  [DayEventKind.Boarded]: CircleCheck,
  [DayEventKind.Arrived]: School,
  [DayEventKind.CheckedOut]: LogOut,
  [DayEventKind.Absent]: UserX,
};

/** The one-line answer to "where is my child now?", with the time it happened. */
export function DayStatusBanner({ day, childName }: { day: ChildDay; childName: string }) {
  const t = useTranslations("parent.day");
  const locale = useLocale() as Locale;
  const Icon = STATUS_ICON[day.status];
  const last = day.events.at(-1);
  const name = firstNameOf(childName);
  const boarded = day.events.find((event) => event.kind === DayEventKind.Boarded);
  const values = {
    name,
    time: last ? formatTime(last.at, locale) : "",
    stop: day.trip?.stop.name ?? "",
    boarded: boarded ? formatTime(boarded.at, locale) : "",
    pickup: day.trip?.stop.pickup_time ? formatClockTime(day.trip.stop.pickup_time, locale) : "",
  };
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex items-start gap-3 rounded-card p-4", STATUS_STYLE[day.status])}
    >
      {LIVE_STATUSES.includes(day.status) ? (
        <LiveDot className="mt-2 shrink-0" />
      ) : (
        <Icon aria-hidden="true" className="mt-0.5 size-6 shrink-0" />
      )}
      <div className="min-w-0">
        <p className="text-h3">{t(`status.${day.status}.title`, values)}</p>
        <p className="mt-0.5 text-body-sm">{t(`status.${day.status}.body`, values)}</p>
      </div>
    </div>
  );
}

/** What happened today, oldest first. */
export function DayTimeline({ events }: { events: readonly DayEvent[] }) {
  const t = useTranslations("parent.day");
  const locale = useLocale() as Locale;
  if (events.length === 0) return <p className="text-body-sm text-ink-muted">{t("noEvents")}</p>;
  return (
    <ol className="flex flex-col">
      {events.map((event, index) => {
        const Icon = EVENT_ICON[event.kind];
        const isLast = index === events.length - 1;
        return (
          <li key={`${event.kind}-${event.at}`} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                aria-hidden="true"
                className={cn(
                  "inline-flex size-9 shrink-0 items-center justify-center rounded-full [&_svg]:size-4",
                  isLast ? "bg-brand text-on-brand" : "bg-brand-soft text-brand",
                )}
              >
                <Icon />
              </span>
              {isLast ? null : <span aria-hidden="true" className="w-0.5 flex-1 bg-line" />}
            </div>
            <div className={cn("min-w-0 pt-1.5", isLast ? "pb-0" : "pb-5")}>
              <p className="text-body-sm font-bold text-ink-strong">
                {t(`event.${event.kind}`, { detail: event.detail ?? "" })}
              </p>
              <time dateTime={event.at} className="text-caption text-ink-muted">
                {formatTime(event.at, locale)}
              </time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
