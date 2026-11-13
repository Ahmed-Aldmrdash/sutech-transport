"use client";

import {
  CalendarDays,
  ClipboardList,
  MessageSquareWarning,
  Siren,
  type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { DayOverview } from "@/features/sg-office/components/day-overview";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { formatNumber, todayInCairo } from "@/lib/format";
import { getOpsOverview } from "../api";
import type { OpsOverview } from "../schema";

/** The Transportation office's home: what waits for it, and the day on every line. */
export function OpsOverviewPage() {
  const t = useTranslations("desk.ops.overview");
  const [date, setDate] = useState(todayInCairo);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        description={t("lead")}
        actions={
          <ButtonLink href="/admin/tracking" variant="secondary">
            {t("liveLink")}
          </ButtonLink>
        }
      />
      <DayOverview
        date={date}
        onDateChange={setDate}
        load={(day, signal) => getOpsOverview({ date: day }, { signal })}
        top={(day) => <Queues queues={day.queues} />}
        lineHref={(lineId) => `/admin/attendance?line=${lineId}&date=${date}`}
      />
    </div>
  );
}

interface Queue {
  key: keyof OpsOverview["queues"];
  href: string;
  icon: LucideIcon;
  urgent?: boolean;
}

const QUEUES: readonly Queue[] = [
  { key: "emergencies_open", href: "/admin/emergencies", icon: Siren, urgent: true },
  { key: "requests_new", href: "/admin/requests", icon: ClipboardList },
  { key: "complaints_new", href: "/admin/complaints", icon: MessageSquareWarning },
  { key: "events_waiting", href: "/admin/events", icon: CalendarDays },
];

/** What waits for the office now, each a link to its page. */
function Queues({ queues }: { queues: OpsOverview["queues"] }) {
  const t = useTranslations("desk.ops.overview.queues");
  const locale = useLocale() as Locale;
  return (
    <section aria-labelledby="ops-queues" className="flex flex-col gap-3">
      <h2 id="ops-queues" className="text-h3 text-ink-strong">
        {t("title")}
      </h2>
      <ul className="grid grid-cols-2 gap-3 desktop:grid-cols-4">
        {QUEUES.map(({ key, href, icon: Icon, urgent }) => {
          const value = queues[key];
          const alarm = urgent && value > 0;
          return (
            <li key={key}>
              <Link
                href={href}
                className={cn(
                  "flex h-full flex-col gap-2 rounded-card border bg-surface-raised p-4 focus-ring hover:bg-surface-alt",
                  alarm ? "border-danger" : value > 0 ? "border-brand" : "border-line",
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-label text-ink-muted">{t(`${key}.label`)}</span>
                  <Icon
                    aria-hidden="true"
                    className={cn("size-5", alarm ? "text-danger-text" : "text-teal")}
                  />
                </span>
                <span className="text-numeric text-ink-strong">{formatNumber(value, locale)}</span>
                <span className="text-caption text-ink-muted">
                  {value > 0 ? t(`${key}.waiting`) : t(`${key}.none`)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
