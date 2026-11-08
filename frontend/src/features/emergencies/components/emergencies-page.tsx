"use client";

import { ChevronRight, Siren } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { FilterChips } from "@/components/ui/filter-chips";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { SOS_TYPE_ICON } from "@/features/sos/components/sos-type";
import { SosStatus } from "@/features/sos/schema";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { formatDateTime, formatNumber } from "@/lib/format";
import { AsyncStatus, useAsync } from "@/lib/hooks/use-async";
import { listAdminSos } from "../api";
import type { AdminSos } from "../schema";
import { SosStatusBadge } from "./sos-status-badge";

/** How often the list is re-read until the WebSocket (sos.new, sos.update) is in place. */
export const EMERGENCIES_REFRESH_MS = 5000;

const Filter = { Active: "active", Closed: "closed", All: "all" } as const;
type Filter = (typeof Filter)[keyof typeof Filter];

function matches(filter: Filter, sos: AdminSos): boolean {
  if (filter === Filter.All) return true;
  return (sos.status === SosStatus.Closed) === (filter === Filter.Closed);
}

/** The office's live list of SOS alerts; open ones first, each a link to its page. */
export function EmergenciesPage() {
  const t = useTranslations("emergencies");
  const [filter, setFilter] = useState<Filter>(Filter.Active);
  const state = useAsync((signal) => listAdminSos({}, { signal }), []);
  const { refresh } = state;

  useEffect(() => {
    const timer = window.setInterval(refresh, EMERGENCIES_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("lead")} />
      <FilterChips
        label={t("filters.label")}
        value={filter}
        onChange={setFilter}
        options={[
          { value: Filter.Active, label: t("filters.active") },
          { value: Filter.Closed, label: t("filters.closed") },
          { value: Filter.All, label: t("filters.all") },
        ]}
      />
      {state.status === AsyncStatus.Loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : null}
      {state.status === AsyncStatus.Error ? (
        <ErrorState error={state.error} onRetry={state.reload} />
      ) : null}
      {state.status === AsyncStatus.Success ? (
        <SosList items={state.data.items.filter((sos) => matches(filter, sos))} filter={filter} />
      ) : null}
    </div>
  );
}

const STATUS_ORDER: Record<SosStatus, number> = {
  [SosStatus.Open]: 0,
  [SosStatus.Acknowledged]: 1,
  [SosStatus.Closed]: 2,
};

function SosList({ items, filter }: { items: AdminSos[]; filter: Filter }) {
  const t = useTranslations("emergencies");
  if (items.length === 0) {
    const empty = filter === Filter.Closed ? "emptyClosed" : "emptyActive";
    return (
      <EmptyState icon={<Siren />} title={t(`${empty}.title`)} description={t(`${empty}.body`)} />
    );
  }
  // Not taken first, then being handled; newest first within each.
  const sorted = [...items].sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.created_at.localeCompare(a.created_at),
  );
  return (
    <ul className="flex flex-col gap-3">
      {sorted.map((sos) => (
        <li key={sos.id}>
          <SosRow sos={sos} />
        </li>
      ))}
    </ul>
  );
}

function SosRow({ sos }: { sos: AdminSos }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const Icon = SOS_TYPE_ICON[sos.type];
  const isOpen = sos.status === SosStatus.Open;
  return (
    <Card className={cn(isOpen && "border-danger")}>
      <Link
        href={`/admin/emergencies/${encodeURIComponent(sos.id)}`}
        className="flex items-center gap-4 rounded-card p-4 focus-ring hover:bg-surface-alt"
      >
        <span
          className={cn(
            "flex size-12 shrink-0 items-center justify-center rounded-full",
            sos.status === SosStatus.Closed
              ? "bg-surface-alt text-ink-muted"
              : "bg-danger-soft text-danger-text",
          )}
        >
          <Icon aria-hidden="true" className="size-6" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-body font-bold text-ink-strong">
              {t(`sos.types.${sos.type}.label`)}
            </p>
            <SosStatusBadge status={sos.status} />
          </div>
          <p className="text-body-sm text-ink">
            {t("emergencies.lineName", { code: sos.line.code, name: sos.line.name })} ·{" "}
            <bdi>{sos.bus.plate}</bdi>
          </p>
          <p className="text-caption text-ink-muted">
            {formatDateTime(sos.created_at, locale)} ·{" "}
            {t("emergencies.onBoard", { count: formatNumber(sos.riders_on_board, locale) })}
          </p>
        </div>
        <ChevronRight
          aria-hidden="true"
          className="size-5 shrink-0 text-ink-muted rtl:-scale-x-100"
        />
      </Link>
    </Card>
  );
}
