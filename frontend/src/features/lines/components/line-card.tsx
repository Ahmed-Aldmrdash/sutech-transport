"use client";

import { Bus, ChevronRight, Clock, MapPin } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatClockTime, formatMoney } from "@/lib/format";
import type { Line } from "../schema";
import { SeatsBadge } from "./seats-badge";

export function lineHref(lineId: string): string {
  return `/student/lines/${encodeURIComponent(lineId)}`;
}

/** One line in the list: number, area, bus, first pickup, stops, seats and price. */
export function LineCard({ line }: { line: Line }) {
  const t = useTranslations("student");
  const locale = useLocale() as Locale;

  return (
    <li>
      <Link
        href={lineHref(line.line_id)}
        className="group flex h-full flex-col gap-3 rounded-card border border-line bg-surface-raised p-4 focus-ring transition-colors hover:border-brand hover:bg-surface-alt"
      >
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="inline-flex h-10 min-w-10 shrink-0 items-center justify-center rounded-sm bg-brand px-2 text-label text-on-brand"
          >
            {line.code}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-body font-bold text-ink-strong">
              <span className="sr-only">{t("lineCode", { code: line.code })} · </span>
              {line.name}
            </h2>
            <p className="text-body-sm text-ink-muted">
              {t("lines.perTerm", { price: formatMoney(line.price_piasters, locale) })}
            </p>
          </div>
          <ChevronRight
            aria-hidden="true"
            className="mt-2 size-5 shrink-0 text-ink-muted rtl:-scale-x-100"
          />
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-body-sm text-ink">
          {line.first_pickup_time ? (
            <li className="flex items-center gap-1.5">
              <Clock aria-hidden="true" className="size-4 text-teal" />
              {t("lines.firstPickup", { time: formatClockTime(line.first_pickup_time, locale) })}
            </li>
          ) : null}
          <li className="flex items-center gap-1.5">
            <MapPin aria-hidden="true" className="size-4 text-teal" />
            {t("lines.stops", { count: line.stop_count })}
          </li>
          <li className="flex items-center gap-1.5">
            <Bus aria-hidden="true" className="size-4 text-teal" />
            {t(`busType.${line.bus_type}`)}
          </li>
        </ul>
        <div className="mt-auto">
          <SeatsBadge available={line.seats_available} />
        </div>
      </Link>
    </li>
  );
}
