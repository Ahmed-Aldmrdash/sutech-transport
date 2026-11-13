"use client";

import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tone } from "@/components/ui/tone";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { formatClockTime, formatNumber } from "@/lib/format";
import { LiveBusStatus, type LiveBus } from "../schema";

export const LIVE_STATUS_TONE: Record<LiveBusStatus, Tone> = {
  [LiveBusStatus.NotStarted]: Tone.Neutral,
  [LiveBusStatus.OnTheRoad]: Tone.Info,
  [LiveBusStatus.Arrived]: Tone.Success,
  [LiveBusStatus.NoService]: Tone.Neutral,
};

/** The buses as a list beside the map: choosing one shows it on the map. */
export function LiveBusList({
  buses,
  selectedId,
  onSelect,
}: {
  buses: LiveBus[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const t = useTranslations("desk.ops.live");
  if (buses.length === 0) {
    return (
      <Card className="p-5">
        <p className="text-body text-ink-muted">{t("noneShown")}</p>
      </Card>
    );
  }
  return (
    <Card className="desktop:max-h-[40rem] desktop:overflow-y-auto">
      <ul aria-label={t("listLabel")} className="divide-y divide-line">
        {buses.map((bus) => (
          <li key={bus.line.line_id}>
            <LiveBusRow
              bus={bus}
              selected={bus.line.line_id === selectedId}
              onSelect={() => onSelect(bus.line.line_id)}
            />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function LiveBusRow({
  bus,
  selected,
  onSelect,
}: {
  bus: LiveBus;
  selected: boolean;
  onSelect: () => void;
}) {
  const t = useTranslations("desk.ops.live");
  const locale = useLocale() as Locale;
  const number = (value: number) => formatNumber(value, locale);
  const where =
    bus.status === LiveBusStatus.OnTheRoad
      ? bus.near_stop
        ? t("near", { stop: bus.near_stop })
        : t("leftFirstStop")
      : bus.status === LiveBusStatus.NotStarted && bus.leaves_at
        ? t("leavesAt", { time: formatClockTime(bus.leaves_at, locale) })
        : null;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex w-full flex-col items-start gap-1 p-4 text-start focus-ring hover:bg-surface-alt",
        selected && "bg-brand-soft",
      )}
    >
      <span className="flex w-full flex-wrap items-center gap-2">
        <span className="font-bold text-ink-strong">
          {t("lineValue", { code: bus.line.code, name: bus.line.name })}
        </span>
        <Badge tone={LIVE_STATUS_TONE[bus.status]}>{t(`statuses.${bus.status}`)}</Badge>
        {bus.sos_open ? <Badge tone={Tone.Danger}>{t("sos")}</Badge> : null}
        {bus.delay_minutes ? (
          <Badge tone={Tone.Warning}>{t("late", { minutes: number(bus.delay_minutes) })}</Badge>
        ) : null}
      </span>
      <span className="text-caption text-ink-muted">
        <bdi>{bus.bus.plate}</bdi> · {bus.bus.driver_name}
        {bus.replaced ? ` · ${t("replaced")}` : ""}
      </span>
      <span className="text-caption text-ink-muted">
        {[where, t("rode", { rode: number(bus.rode), subscribers: number(bus.subscribers) })]
          .filter(Boolean)
          .join(" · ")}
      </span>
    </button>
  );
}
