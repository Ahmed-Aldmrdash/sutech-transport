"use client";

import { Bus, CalendarX, CircleCheck, CircleSlash, DoorOpen, LogOut, School, Undo2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { EmptyState } from "@/components/ui/States";
import { cn } from "@/lib/cn";
import { formatTime } from "@/lib/time";
import { type AttendanceEvent, AttendanceEventType } from "../schema";

const ICON: Record<AttendanceEventType, { icon: LucideIcon; tone: string }> = {
  [AttendanceEventType.Skipped]: { icon: CalendarX, tone: "bg-warning-soft text-warning-text" },
  [AttendanceEventType.Unskipped]: { icon: Undo2, tone: "bg-surface-alt text-ink" },
  [AttendanceEventType.Boarded]: { icon: Bus, tone: "bg-teal-soft text-teal-text" },
  [AttendanceEventType.Arrived]: { icon: School, tone: "bg-success-soft text-success-text" },
  [AttendanceEventType.CheckedOut]: { icon: LogOut, tone: "bg-coral-soft text-coral-text" },
  [AttendanceEventType.Absent]: { icon: CircleSlash, tone: "bg-danger-soft text-danger" },
  [AttendanceEventType.ReturnBoarded]: { icon: DoorOpen, tone: "bg-teal-soft text-teal-text" },
  [AttendanceEventType.ReturnArrived]: { icon: CircleCheck, tone: "bg-success-soft text-success-text" },
};

/** What happened today, in order: boarding, arrival, check-out, absence... Used by the student and the parent. */
export function DayTimeline({ events, emptyText }: { events: AttendanceEvent[]; emptyText: string }) {
  const t = useTranslations("status.attendance");
  const locale = useLocale();
  if (!events.length) return <EmptyState title={emptyText} />;
  return (
    <ol className="flex flex-col">
      {events.map((event, index) => {
        const { icon: Icon, tone } = ICON[event.type];
        const last = index === events.length - 1;
        return (
          <li key={`${event.type}-${event.at}`} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", tone)}>
                <Icon className="size-4" aria-hidden />
              </span>
              {!last && <span aria-hidden className="w-0.5 flex-1 bg-line" />}
            </div>
            <div className={cn("min-w-0 flex-1", !last && "pb-4")}>
              <p className="flex flex-wrap items-baseline justify-between gap-x-3 font-bold text-ink-strong">
                {t(event.type)}
                <time dateTime={event.at} className="num text-[14px] font-normal text-ink-muted">
                  {formatTime(event.at, locale)}
                </time>
              </p>
              {event.detail && <p className="text-[14px] text-ink-muted">{event.detail}</p>}
              {event.recorded_by && <p className="text-[13px] text-ink-muted">{event.recorded_by}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
