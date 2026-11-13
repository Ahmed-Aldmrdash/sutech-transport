"use client";

import { Armchair, Clock, Undo2, Wallet } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { StatTile } from "@/components/ui/stat-tile";
import type { Locale } from "@/i18n/routing";
import { formatArrival, formatClockTime, formatMoneyParts, formatNumber } from "@/lib/format";
import type { Line } from "../schema";

/** Price, free seats, campus arrival and return time, as four tiles. */
export function LineFacts({ line }: { line: Line }) {
  const t = useTranslations("student");
  const locale = useLocale() as Locale;
  return (
    <div className="grid grid-cols-2 gap-3 desktop:grid-cols-4">
      <StatTile
        label={t("line.price")}
        value={<Price piasters={line.price_piasters} locale={locale} />}
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
        caption={
          line.campus_arrival.from === line.campus_arrival.to
            ? undefined
            : formatArrival(line.campus_arrival, locale)
        }
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

/**
 * "EGP 15,000" is wider than a half-width tile on a phone, and the space inside a formatted
 * price never breaks. The currency is a smaller word of its own that can wrap to the next line,
 * so the amount is always shown whole.
 */
function Price({ piasters, locale }: { piasters: number; locale: Locale }) {
  const { amount, currency, currencyFirst } = formatMoneyParts(piasters, locale);
  const unit = <span className="text-body-sm font-bold text-ink-muted">{currency}</span>;
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
      {currencyFirst ? unit : null}
      <bdi className="whitespace-nowrap">{amount}</bdi>
      {currencyFirst ? null : unit}
    </span>
  );
}
