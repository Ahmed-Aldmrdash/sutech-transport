"use client";

import { Armchair, Bus, Route, Warehouse } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { BackLink } from "@/components/ui/back-link";
import { PageHeader } from "@/components/ui/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { DataTable } from "@/components/ui/table";
import { Tone } from "@/components/ui/tone";
import { DeskListState } from "@/features/desk-kit/components/desk-list-state";
import { CallLink } from "@/features/emergencies/components/sos-facts";
import type { Locale } from "@/i18n/routing";
import { formatNumber } from "@/lib/format";
import { useAsync } from "@/lib/hooks/use-async";
import { getFleet } from "../api";
import { FleetBusState, type Fleet, type FleetBus } from "../schema";

const STATE_TONE: Record<FleetBus["today"], Tone> = {
  [FleetBusState.OnLine]: Tone.Info,
  [FleetBusState.Replacement]: Tone.Warning,
  [FleetBusState.Spare]: Tone.Success,
};

/** Abu El Hol's buses and drivers, and what each does today. */
export function FleetPage() {
  const t = useTranslations("desk.company.fleet");
  const locale = useLocale() as Locale;
  const state = useAsync((signal) => getFleet({ signal }), []);
  const number = (value: number) => formatNumber(value, locale);

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/admin/bus-company">{t("back")}</BackLink>
      <PageHeader title={t("title")} description={t("lead")} />
      <DeskListState state={state}>
        {(fleet: Fleet) => (
          <>
            <div className="grid grid-cols-2 gap-3 desktop:grid-cols-4">
              <StatTile label={t("total")} value={number(fleet.counts.total)} icon={<Bus />} />
              <StatTile label={t("onLine")} value={number(fleet.counts.on_line)} icon={<Route />} />
              <StatTile
                label={t("spare")}
                value={number(fleet.counts.spare)}
                icon={<Warehouse />}
              />
              <StatTile label={t("seats")} value={number(fleet.counts.seats)} icon={<Armchair />} />
            </div>
            <FleetTable items={fleet.items} />
          </>
        )}
      </DeskListState>
    </div>
  );
}

/** Every bus with its driver and its day. `action` adds a last column (the office's buttons). */
export function FleetTable({
  items,
  action,
}: {
  items: FleetBus[];
  action?: { header: string; cell: (bus: FleetBus) => ReactNode };
}) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  return (
    <DataTable
      caption={t("desk.company.fleet.caption")}
      rows={items}
      getRowKey={(bus) => bus.bus_id}
      columns={[
        {
          key: "plate",
          header: t("desk.events.table.plate"),
          cell: (bus) => <bdi className="font-bold text-ink-strong">{bus.plate}</bdi>,
        },
        {
          key: "type",
          header: t("desk.events.table.type"),
          cell: (bus) =>
            t("desk.events.typeSeats", {
              type: t(`student.busType.${bus.bus_type}`),
              seats: formatNumber(bus.seats, locale),
            }),
        },
        {
          key: "line",
          header: t("desk.company.fleet.line"),
          cell: (bus) =>
            bus.line
              ? t("desk.company.reply.onLine", { code: bus.line.code, name: bus.line.name })
              : t("desk.company.reply.spare"),
        },
        {
          key: "driver",
          header: t("desk.events.table.driver"),
          cell: (bus) => <CallLink name={bus.driver_name} phone={bus.driver_phone} />,
        },
        {
          key: "today",
          header: t("desk.company.fleet.today"),
          cell: (bus) => (
            <div className="flex flex-col items-start gap-1">
              <Badge tone={STATE_TONE[bus.today]}>
                {bus.covering_line
                  ? t("desk.company.fleet.covering", { code: bus.covering_line.code })
                  : t(`desk.company.fleet.states.${bus.today}`)}
              </Badge>
              {bus.event_today ? (
                <Badge tone={Tone.Brand}>
                  {t("desk.company.fleet.event", { title: bus.event_today.title })}
                </Badge>
              ) : null}
            </div>
          ),
        },
        ...(action ? [{ key: "action", header: action.header, cell: action.cell }] : []),
      ]}
    />
  );
}
