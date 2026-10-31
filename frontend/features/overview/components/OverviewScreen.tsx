"use client";

import { Activity, AlertTriangle, Bus, CreditCard, Inbox, Users, Wallet } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { Async } from "@/components/ui/Async";
import { Card, CardTitle } from "@/components/ui/Card";
import { Meter } from "@/components/ui/Meter";
import { Pill } from "@/components/ui/Pill";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState } from "@/components/ui/States";
import { useApi, usePolling } from "@/lib/api/use-api";
import { formatMoney } from "@/lib/money";
import { useLive } from "@/lib/realtime";
import { formatTime } from "@/lib/time";
import { getOverview } from "../api";

const REFRESH_MS = 15_000;

/** The day at a glance for the transport office (and read-only for the secretary general). */
export function OverviewScreen({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("admin.overview");
  const locale = useLocale();
  const query = useApi(getOverview);
  usePolling(query.reload, REFRESH_MS);
  useLive("sos.new", () => undefined);
  return (
    <>
      {!compact && <PageHeader title={t("title")} subtitle={t("subtitle")} />}
      <Async query={query}>
        {(data) => (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard icon={<Users className="size-5" aria-hidden />} label={t("subscribers")} value={data.active_subscribers} hint={t("seats", { booked: data.seats_booked, total: data.seats_total })} />
              <StatCard icon={<Bus className="size-5" aria-hidden />} tone="teal" label={t("tripsRunning")} value={data.trips_running} />
              <StatCard icon={<AlertTriangle className="size-5" aria-hidden />} tone={data.open_sos ? "danger" : "success"} label={t("openSos")} value={data.open_sos} />
              <StatCard icon={<Wallet className="size-5" aria-hidden />} tone="success" label={t("revenue")} value={formatMoney(data.revenue_term, locale)} />
              <StatCard icon={<CreditCard className="size-5" aria-hidden />} tone="warning" label={t("pendingPayments")} value={data.pending_payments} />
              <StatCard icon={<Inbox className="size-5" aria-hidden />} tone="warning" label={t("openRequests")} value={data.open_requests} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardTitle>{t("occupancy")}</CardTitle>
                <ul className="flex flex-col gap-3">
                  {data.lines.map((line) => (
                    <li key={line.line_id} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2 text-[14px]">
                        <span className="font-bold text-ink-strong">{line.line_name}</span>
                        <span className="flex items-center gap-2">
                          {line.delay_minutes > 0 && <Pill tone="warning">{t("late", { minutes: line.delay_minutes })}</Pill>}
                          <span className="num text-ink-muted">
                            {line.booked}/{line.capacity}
                          </span>
                        </span>
                      </div>
                      <Meter value={line.booked} max={line.capacity} label={line.line_name} />
                    </li>
                  ))}
                </ul>
              </Card>
              <Card>
                <CardTitle action={<Activity className="size-5 text-teal" aria-hidden />}>{t("feed")}</CardTitle>
                {data.feed.length === 0 ? (
                  <EmptyState title={t("feedEmpty")} />
                ) : (
                  <ol className="flex max-h-96 flex-col gap-2 overflow-y-auto">
                    {data.feed.map((item, index) => (
                      <li key={`${item.at}-${index}`} className="flex gap-3 text-[14px]">
                        <time dateTime={item.at} className="num w-16 shrink-0 text-ink-muted">
                          {formatTime(item.at, locale)}
                        </time>
                        <span className="text-ink-strong">{item.text}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </Card>
            </div>
          </div>
        )}
      </Async>
    </>
  );
}
