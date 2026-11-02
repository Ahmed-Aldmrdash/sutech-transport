"use client";

import { Armchair, Clock, Undo2, Wallet } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { StatTile } from "@/components/ui/stat-tile";
import type { Locale } from "@/i18n/routing";
import { formatClockTime, formatMoney, formatNumber } from "@/lib/format";
import type { Line } from "../schema";

/** Price, free seats, campus arrival and return time, as four tiles. */
export function LineFacts({ line }: { line: Line }) {
  const t = useTranslations("student");
  const locale = useLocale() as Locale;
  return (
    <div className="grid grid-cols-2 gap-3 desktop:grid-cols-4">
      <StatTile
        label={t("line.price")}
        value={formatMoney(line.price_piasters, locale)}
        icon={<Wallet />}
      />
      <StatTile
        label={t("line.seats")}
        value={
          line.seats_available > 0 ? formatNumber(line.seats_available, locale) : t("lines.full")
        }
        caption={t("line.seatsOf", { total: formatNumber(line.seats_total, locale) })}
        icon={<Armchair />}
      />
      <StatTile
        label={t("line.arrival")}
        value={formatClockTime(line.campus_arrival.from, locale)}
        caption={t("arrivalWindow", {
          from: formatClockTime(line.campus_arrival.from, locale),
          to: formatClockTime(line.campus_arrival.to, locale),
        })}
        icon={<Clock />}
      />
      <StatTile
        label={t("line.returnTime")}
        value={
          line.return_departure_time ? (
            formatClockTime(line.return_departure_time, locale)
          ) : (
            <span className="text-h3">{t("toBeAnnounced")}</span>
          )
        }
        icon={<Undo2 />}
      />
    </div>
  );
}
