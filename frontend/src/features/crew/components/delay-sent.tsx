"use client";

import { useLocale, useTranslations } from "next-intl";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { Locale } from "@/i18n/routing";
import { formatNumber, formatTime } from "@/lib/format";
import { type CrewTrip } from "../schema";

export function Sent({ trip }: { trip: CrewTrip }) {
  const t = useTranslations("crew.delay");
  const tTrip = useTranslations("crew.trip");
  const locale = useLocale() as Locale;
  return (
    <Card>
      <CardHeader title={t("sentListTitle")} headingLevel={2} />
      <CardBody>
        {trip.delays.length === 0 ? (
          <p className="text-body-sm text-ink-muted">{t("sentListEmpty")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {[...trip.delays].reverse().map((delay) => (
              <li key={delay.delay_id} className="rounded-md border border-line p-3">
                <p className="text-body font-bold text-ink-strong">
                  {tTrip("delayMinutes", { minutes: formatNumber(delay.minutes, locale) })} ·{" "}
                  {tTrip(`delayReasons.${delay.reason}`)}
                </p>
                <p className="text-body-sm text-ink-muted">
                  {formatTime(delay.reported_at, locale)}
                  {delay.note ? ` · ${delay.note}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
