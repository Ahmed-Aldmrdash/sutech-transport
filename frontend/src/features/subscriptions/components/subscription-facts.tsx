"use client";

import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import { formatClockTime, formatMoney } from "@/lib/format";
import type { Subscription } from "../schema";

/** Line, stop, pickup time, term and price of a booking. */
export function SubscriptionFacts({ subscription }: { subscription: Subscription }) {
  const t = useTranslations("student.home.subscription");
  const tStudent = useTranslations("student");
  const locale = useLocale() as Locale;
  const rows = [
    {
      label: t("line"),
      value: `${tStudent("lineCode", { code: subscription.line.code })} · ${subscription.line.name}`,
    },
    { label: t("stop"), value: subscription.stop.name },
    {
      label: t("pickup"),
      value: subscription.stop.pickup_time
        ? formatClockTime(subscription.stop.pickup_time, locale)
        : tStudent("toBeAnnounced"),
    },
    { label: t("term"), value: subscription.term.name },
    { label: t("price"), value: formatMoney(subscription.price_piasters, locale) },
  ];
  return (
    <dl className="grid gap-x-6 sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label} className="flex flex-col gap-0.5 border-t border-line py-2.5">
          <dt className="text-caption text-ink-muted">{row.label}</dt>
          <dd className="text-body-sm font-bold text-ink-strong">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
