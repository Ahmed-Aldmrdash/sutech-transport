"use client";

import { Armchair, Bus, Route, Warehouse } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/ui/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { DeskListState } from "@/features/desk-kit/components/desk-list-state";
import { FleetTable } from "@/features/event-buses/components/fleet-page";
import type { Locale } from "@/i18n/routing";
import { formatNumber } from "@/lib/format";
import { useAsync } from "@/lib/hooks/use-async";
import { getOpsFleet } from "../api";
import type { OpsFleet } from "../schema";
import { ChangeCrewButton } from "./change-crew-button";

/** Every bus and driver working for the university, and changing a line's bus or driver today. */
export function BusesPage() {
  const t = useTranslations("desk.ops.buses");
  const tFleet = useTranslations("desk.company.fleet");
  const locale = useLocale() as Locale;
  const state = useAsync((signal) => getOpsFleet({ signal }), []);
  const number = (value: number) => formatNumber(value, locale);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("lead")} />
      <DeskListState state={state}>
        {(fleet: OpsFleet) => (
          <>
            <div className="grid grid-cols-2 gap-3 desktop:grid-cols-4">
              <StatTile label={tFleet("total")} value={number(fleet.counts.total)} icon={<Bus />} />
              <StatTile
                label={tFleet("onLine")}
                value={number(fleet.counts.on_line)}
                icon={<Route />}
              />
              <StatTile
                label={tFleet("spare")}
                value={number(fleet.counts.spare)}
                icon={<Warehouse />}
              />
              <StatTile
                label={tFleet("seats")}
                value={number(fleet.counts.seats)}
                icon={<Armchair />}
              />
            </div>
            <FleetTable
              items={fleet.items}
              action={{
                header: t("today"),
                cell: (bus) => {
                  const trip = fleet.trips.find((item) => item.line_id === bus.line?.line_id);
                  return trip ? (
                    <ChangeCrewButton tripId={trip.trip_id} onChanged={state.refresh} size="sm" />
                  ) : null;
                },
              }}
            />
          </>
        )}
      </DeskListState>
    </div>
  );
}
