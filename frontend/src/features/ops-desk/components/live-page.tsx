"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { FilterChips } from "@/components/ui/filter-chips";
import { Tone } from "@/components/ui/tone";
import { TestDayButton } from "@/features/crew/components/test-day-button";
import { PageHeader } from "@/components/ui/page-header";
import { DeskListState } from "@/features/desk-kit/components/desk-list-state";
import type { Locale } from "@/i18n/routing";
import { formatNumber, formatTime } from "@/lib/format";
import { useAsync } from "@/lib/hooks/use-async";
import { getLiveBuses } from "../api";
import { LiveBusStatus, type LiveBus, type LiveBuses } from "../schema";
import { FleetMap, type FleetMapBus } from "./fleet-map";
import { LiveBusCard } from "./live-bus-card";
import { LiveBusList } from "./live-bus-list";

/** Positions move every few seconds; the WebSocket replaces this once the server has it. */
const REFRESH_MS = 10_000;

const Filter = { All: "all", Road: "road", Late: "late", Alerts: "alerts" } as const;
type Filter = (typeof Filter)[keyof typeof Filter];

const KEEP: Record<Filter, (bus: LiveBus) => boolean> = {
  [Filter.All]: () => true,
  [Filter.Road]: (bus) => bus.status === LiveBusStatus.OnTheRoad,
  [Filter.Late]: (bus) => bus.delay_minutes !== null,
  [Filter.Alerts]: (bus) => bus.sos_open,
};

/** Every bus on one map, for the Transportation office. */
export function LivePage() {
  const t = useTranslations("desk.ops.live");
  const locale = useLocale() as Locale;
  const state = useAsync((signal) => getLiveBuses({ signal }), []);
  const { refresh } = state;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>(Filter.All);

  useEffect(() => {
    const timer = window.setInterval(refresh, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("lead")} />
      <DeskListState state={state}>
        {(live: LiveBuses) => (
          <LiveView
            live={live}
            filter={filter}
            onFilter={setFilter}
            selectedId={selectedId}
            onSelect={setSelectedId}
            updatedAt={formatTime(live.generated_at, locale)}
            onChanged={refresh}
          />
        )}
      </DeskListState>
    </div>
  );
}

function LiveView({
  live,
  filter,
  onFilter,
  selectedId,
  onSelect,
  updatedAt,
  onChanged,
}: {
  live: LiveBuses;
  filter: Filter;
  onFilter: (filter: Filter) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  updatedAt: string;
  onChanged: () => void;
}) {
  const t = useTranslations("desk.ops.live");
  const locale = useLocale() as Locale;
  const number = (value: number) => formatNumber(value, locale);
  const shown = live.items.filter(KEEP[filter]);
  const selected = live.items.find((bus) => bus.line.line_id === selectedId) ?? null;
  const pins = useMemo<FleetMapBus[]>(
    () =>
      shown.flatMap((bus) =>
        bus.position
          ? [
              {
                id: bus.line.line_id,
                code: bus.line.code,
                label: t("pinLabel", { code: bus.line.code, plate: bus.bus.plate }),
                position: bus.position,
                alert: bus.sos_open ? "sos" : bus.delay_minutes ? "late" : null,
              },
            ]
          : [],
      ),
    [shown, t],
  );
  const allIdle = live.items.every((bus) => bus.status === LiveBusStatus.NoService);
  const counts = {
    road: live.items.filter(KEEP[Filter.Road]).length,
    late: live.items.filter(KEEP[Filter.Late]).length,
    alerts: live.items.filter(KEEP[Filter.Alerts]).length,
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterChips
          label={t("filters.label")}
          value={filter}
          onChange={onFilter}
          options={[
            { value: Filter.All, label: t("filters.all", { count: number(live.items.length) }) },
            { value: Filter.Road, label: t("filters.road", { count: number(counts.road) }) },
            { value: Filter.Late, label: t("filters.late", { count: number(counts.late) }) },
            { value: Filter.Alerts, label: t("filters.alerts", { count: number(counts.alerts) }) },
          ]}
        />
        <p className="text-caption text-ink-muted" aria-live="polite">
          {t("updatedAt", { time: updatedAt })}
        </p>
      </div>
      {counts.road === 0 ? (
        <Alert
          tone={Tone.Info}
          title={allIdle ? t("noServiceTitle") : t("noneOnRoadTitle")}
          action={allIdle ? <TestDayButton onStarted={onChanged} /> : undefined}
        >
          {allIdle ? t("noServiceBody") : t("noneOnRoadBody")}
        </Alert>
      ) : null}
      <div className="grid grid-cols-1 items-start gap-4 desktop:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-4">
          <FleetMap
            buses={pins}
            campus={live.campus_location}
            selectedId={selectedId}
            onSelect={onSelect}
          />
          {selected ? (
            <LiveBusCard bus={selected} onClose={() => onSelect(null)} onChanged={onChanged} />
          ) : null}
        </div>
        <LiveBusList buses={shown} selectedId={selectedId} onSelect={onSelect} />
      </div>
    </div>
  );
}
