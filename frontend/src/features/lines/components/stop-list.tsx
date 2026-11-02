"use client";

import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { formatClockTime } from "@/lib/format";
import type { Stop } from "../schema";

interface StopListProps {
  stops: readonly Stop[];
  /** When given, each stop is a radio button the student picks to board at. */
  selectable?: { name: string; selectedId: string | null; onSelect: (stopId: string) => void };
  /** The student's own stop, marked when not selecting. */
  highlightedId?: string | null;
}

/** The line's stops as a timeline: time, name and the office's landmark note. */
export function StopList({ stops, selectable, highlightedId }: StopListProps) {
  const t = useTranslations("student");
  const locale = useLocale() as Locale;

  return (
    <ol className="flex flex-col">
      {stops.map((stop, index) => {
        const isLast = index === stops.length - 1;
        const isChosen = (selectable?.selectedId ?? highlightedId) === stop.stop_id;
        const inputId = `stop-${stop.stop_id}`;
        const content = (
          <>
            <span className="w-16 shrink-0 pt-0.5 text-body-sm font-bold text-ink-strong tabular-nums">
              {stop.pickup_time ? formatClockTime(stop.pickup_time, locale) : t("toBeAnnounced")}
            </span>
            <span
              aria-hidden="true"
              className="relative flex w-5 shrink-0 justify-center self-stretch"
            >
              <span
                className={cn(
                  "z-10 mt-1 size-3.5 rounded-full border-2",
                  isChosen ? "border-brand bg-brand" : "border-teal bg-surface-raised",
                )}
              />
              {!isLast ? <span className="absolute top-5 bottom-0 w-0.5 bg-line-strong" /> : null}
            </span>
            <span className="min-w-0 flex-1 pb-4">
              <span className="block text-body font-bold text-ink-strong">{stop.name}</span>
              {stop.note ? (
                <span className="block text-body-sm text-ink-muted">{stop.note}</span>
              ) : null}
            </span>
          </>
        );

        return (
          <li key={stop.stop_id}>
            {selectable ? (
              <label
                htmlFor={inputId}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-md px-2 pt-2 transition-colors hover:bg-surface-alt",
                  "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-teal",
                  isChosen && "bg-brand-soft hover:bg-brand-soft",
                )}
              >
                <input
                  id={inputId}
                  type="radio"
                  name={selectable.name}
                  value={stop.stop_id}
                  checked={isChosen}
                  onChange={() => selectable.onSelect(stop.stop_id)}
                  className="sr-only"
                />
                {content}
              </label>
            ) : (
              <div
                className={cn(
                  "flex items-start gap-3 rounded-md px-2 pt-2",
                  isChosen && "bg-brand-soft",
                )}
              >
                {content}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
