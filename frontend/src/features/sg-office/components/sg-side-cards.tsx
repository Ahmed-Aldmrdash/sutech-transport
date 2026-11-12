"use client";

import { CalendarDays, Siren } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Tone } from "@/components/ui/tone";
import { EventStatus } from "@/features/event-buses/schema";
import { SosStatus } from "@/features/sos/schema";
import type { Locale } from "@/i18n/routing";
import { formatClockTime, formatNumber, formatTime } from "@/lib/format";
import type { SgOverview } from "../schema";

const SOS_TONE: Record<SosStatus, Tone> = {
  [SosStatus.Open]: Tone.Danger,
  [SosStatus.Acknowledged]: Tone.Warning,
  [SosStatus.Closed]: Tone.Neutral,
};

function ListCard({
  title,
  icon,
  empty,
  children,
}: {
  title: string;
  icon: ReactNode;
  empty: string | null;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader title={title} headingLevel={2} />
      <CardBody>
        {empty ? (
          <p className="flex items-center gap-2 text-body-sm text-ink-muted">
            <span aria-hidden="true" className="inline-flex text-teal [&_svg]:size-5">
              {icon}
            </span>
            {empty}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">{children}</ul>
        )}
      </CardBody>
    </Card>
  );
}

/** The day's SOS alerts: read-only, the Transportation office and the clinic handle them. */
export function SgEmergencies({ items }: { items: SgOverview["emergencies"] }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  return (
    <ListCard
      title={t("desk.sg.emergencies.title")}
      icon={<Siren />}
      empty={items.length === 0 ? t("desk.sg.emergencies.empty") : null}
    >
      {items.map((item) => (
        <li
          key={item.sos_id}
          className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
        >
          <div className="min-w-0">
            <p className="text-body-sm font-bold text-ink-strong">
              {t(`sos.types.${item.type}.label`)} ·{" "}
              {t("desk.sg.lines.lineValue", { code: item.line.code, name: item.line.name })}
            </p>
            <p className="text-caption text-ink-muted">{formatTime(item.raised_at, locale)}</p>
          </div>
          <Badge tone={SOS_TONE[item.status]}>{t(`emergencies.status.${item.status}`)}</Badge>
        </li>
      ))}
    </ListCard>
  );
}

/** The day's event buses. */
export function SgEvents({ items }: { items: SgOverview["events"] }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  return (
    <ListCard
      title={t("desk.sg.events.title")}
      icon={<CalendarDays />}
      empty={items.length === 0 ? t("desk.sg.events.empty") : null}
    >
      {items.map((item) => (
        <li
          key={item.event_id}
          className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
        >
          <div className="min-w-0">
            <p className="text-body-sm font-bold text-ink-strong">{item.title}</p>
            <p className="text-caption text-ink-muted">
              {[
                formatClockTime(item.departs_at, locale),
                item.destination,
                t("desk.events.studentsValue", {
                  count: formatNumber(item.students_count, locale),
                }),
                t("desk.sg.events.buses", { count: formatNumber(item.buses, locale) }),
              ].join(" · ")}
            </p>
          </div>
          <Badge tone={item.status === EventStatus.Confirmed ? Tone.Success : Tone.Warning}>
            {t(`desk.events.status.${item.status}`)}
          </Badge>
        </li>
      ))}
    </ListCard>
  );
}
