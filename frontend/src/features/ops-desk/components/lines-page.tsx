"use client";

import { Armchair, Route, UserRound, UsersRound } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { TextField } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { DataTable } from "@/components/ui/table";
import { DeskListState } from "@/features/desk-kit/components/desk-list-state";
import { CallLink } from "@/features/emergencies/components/sos-facts";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatClockTime, formatNumber } from "@/lib/format";
import { useAsync } from "@/lib/hooks/use-async";
import { listOpsLines } from "../api";
import type { OpsLine, OpsLines } from "../schema";

/** Every line with its bus, driver, stops and seats. A line opens its stops and riders. */
export function LinesPage() {
  const t = useTranslations("desk.ops.lines");
  const locale = useLocale() as Locale;
  const state = useAsync((signal) => listOpsLines({ signal }), []);
  const [search, setSearch] = useState("");
  const number = (value: number) => formatNumber(value, locale);
  const needle = search.trim().toLowerCase();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("lead")} />
      <DeskListState state={state}>
        {(lines: OpsLines) => (
          <>
            <div className="grid grid-cols-2 gap-3 desktop:grid-cols-4">
              <StatTile label={t("total")} value={number(lines.totals.lines)} icon={<Route />} />
              <StatTile label={t("seats")} value={number(lines.totals.seats)} icon={<Armchair />} />
              <StatTile
                label={t("subscribers")}
                value={number(lines.totals.subscribers)}
                icon={<UsersRound />}
              />
              <StatTile
                label={t("free")}
                value={number(lines.totals.seats_free)}
                icon={<UserRound />}
              />
            </div>
            <TextField
              type="search"
              label={t("search")}
              value={search}
              containerClassName="w-full max-w-sm"
              onChange={(event) => setSearch(event.target.value)}
            />
            <LinesTable
              items={lines.items.filter(
                (item) =>
                  !needle ||
                  item.line.code.toLowerCase().includes(needle) ||
                  item.line.name.toLowerCase().includes(needle),
              )}
            />
          </>
        )}
      </DeskListState>
    </div>
  );
}

function LinesTable({ items }: { items: OpsLine[] }) {
  const t = useTranslations("desk.ops.lines");
  const tAll = useTranslations();
  const locale = useLocale() as Locale;
  const number = (value: number) => formatNumber(value, locale);
  return (
    <DataTable
      caption={t("title")}
      rows={items}
      getRowKey={(item) => item.line.line_id}
      empty={t("noMatch")}
      columns={[
        {
          key: "line",
          header: t("line"),
          cell: (item) => (
            <Link
              href={`/admin/lines/${item.line.line_id}`}
              className="font-bold text-brand underline-offset-4 focus-ring hover:underline"
            >
              {t("lineValue", { code: item.line.code, name: item.line.name })}
            </Link>
          ),
        },
        {
          key: "bus",
          header: t("bus"),
          cell: (item) => (
            <span className="flex flex-col">
              <bdi className="font-bold text-ink-strong">{item.bus.plate}</bdi>
              <span className="text-caption text-ink-muted">
                {tAll("desk.events.typeSeats", {
                  type: tAll(`student.busType.${item.bus.bus_type}`),
                  seats: number(item.bus.seats),
                })}
              </span>
            </span>
          ),
        },
        {
          key: "driver",
          header: t("driver"),
          cell: (item) => <CallLink name={item.bus.driver_name} phone={item.bus.driver_phone} />,
        },
        {
          key: "stops",
          header: t("stops"),
          cell: (item) =>
            t("stopsValue", {
              count: number(item.stops),
              time: item.first_pickup ? formatClockTime(item.first_pickup, locale) : "—",
            }),
        },
        {
          key: "seats",
          header: t("riders"),
          align: "end",
          cell: (item) => (
            <span className="flex flex-col items-end">
              <span className="font-bold text-ink-strong tabular-nums">
                {number(item.subscribers)}/{number(item.bus.seats)}
              </span>
              <span className="text-caption text-ink-muted">
                {item.seats_free || item.reserved
                  ? t("freeValue", { free: number(item.seats_free), held: number(item.reserved) })
                  : t("full")}
              </span>
            </span>
          ),
        },
      ]}
    />
  );
}
