"use client";

import { CalendarX2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import { formatServiceDay } from "@/lib/format";
import { type ChildDay } from "../schema";

/** The days the child said they won't ride, today and coming ones. Nothing when none. */
export function DaysOffList({ day }: { day: ChildDay }) {
  const t = useTranslations("parent");
  const locale = useLocale() as Locale;
  if (day.days_off.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 rounded-md bg-surface-alt p-3">
      <p className="flex items-center gap-2 text-body-sm font-bold text-ink-strong">
        <CalendarX2 aria-hidden="true" className="size-4 shrink-0" />
        {t("daysOff.title")}
      </p>
      <ul className="flex flex-col gap-1">
        {day.days_off.map((item) => (
          <li key={item.service_date} className="text-body-sm text-ink">
            {t("daysOff.item", {
              day:
                item.service_date === day.service_date
                  ? t("daysOff.today")
                  : formatServiceDay(item.service_date, locale),
              reason: item.note ?? t(`reasons.${item.reason}`),
            })}
          </li>
        ))}
      </ul>
    </div>
  );
}
