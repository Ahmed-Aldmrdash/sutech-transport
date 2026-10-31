"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { Async } from "@/components/ui/Async";
import { Pill } from "@/components/ui/Pill";
import { EmptyState } from "@/components/ui/States";
import { useApi, usePolling } from "@/lib/api/use-api";
import { cn } from "@/lib/cn";
import { getLiveLines } from "../api";
import { TripState } from "../schema";
import { TrackingView } from "./TrackingView";

const REFRESH_MS = 15_000;

/** Every line's bus on one screen; pick a line to see its map and stops. */
export function LiveScreen() {
  const t = useTranslations("admin.live");
  const tt = useTranslations("tracking");
  const query = useApi(getLiveLines);
  usePolling(query.reload, REFRESH_MS);
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <Async query={query}>
        {(lines) => {
          if (!lines.length) return <EmptyState title={t("empty")} />;
          const current = lines.find((line) => line.line_id === selected) ?? lines[0]!;
          return (
            <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
              <ul className="flex flex-col gap-2" aria-label={t("lines")}>
                {lines.map((line) => (
                  <li key={line.line_id}>
                    <button
                      type="button"
                      aria-pressed={line.line_id === current.line_id}
                      onClick={() => setSelected(line.line_id)}
                      className={cn(
                        "flex w-full flex-col gap-1 rounded-card border p-3 text-start",
                        line.line_id === current.line_id ? "border-brand bg-brand-soft" : "border-line bg-surface-raised hover:border-brand",
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-bold text-ink-strong">{line.line_name}</span>
                        <Pill tone={line.state === TripState.InProgress ? "teal" : "neutral"}>{tt(`state.${line.state}`)}</Pill>
                      </span>
                      <span className="text-[13px] text-ink-muted">
                        <bdi>{line.bus_plate ?? "—"}</bdi> · {t("riders", { boarded: line.riders_boarded, total: line.riders_total })}
                      </span>
                      {line.delay_minutes > 0 && <Pill tone="warning">{tt("delayed", { minutes: line.delay_minutes })}</Pill>}
                    </button>
                  </li>
                ))}
              </ul>
              <TrackingView key={current.line_id} data={current} />
            </div>
          );
        }}
      </Async>
    </>
  );
}
