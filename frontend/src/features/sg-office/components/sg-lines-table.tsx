"use client";

import { CircleCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { FilterChips } from "@/components/ui/filter-chips";
import { DataTable } from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import { Tone } from "@/components/ui/tone";
import type { Locale } from "@/i18n/routing";
import { formatNumber } from "@/lib/format";
import { LineDayStatus, type SgLine } from "../schema";

const STATUS_TONE: Record<LineDayStatus, Tone> = {
  [LineDayStatus.NoService]: Tone.Neutral,
  [LineDayStatus.NotStarted]: Tone.Neutral,
  [LineDayStatus.InProgress]: Tone.Info,
  [LineDayStatus.Ended]: Tone.Success,
};

const PERCENT = 100;

const LinesFilter = { Attention: "attention", All: "all" } as const;
type LinesFilter = (typeof LinesFilter)[keyof typeof LinesFilter];

/** Late, or given another bus or driver. */
function needsAttention(line: SgLine): boolean {
  return line.delay_minutes !== null || line.replaced;
}

/**
 * Every line's morning: the bus, how far it got, and who rode. With 20+ lines the table opens
 * on the lines that need attention; "All lines" shows the rest.
 */
export function SgLinesTable({
  lines,
  lineHref,
}: {
  lines: SgLine[];
  /** Where a line's name links to (the Transportation office opens the line's riders). */
  lineHref?: (lineId: string) => string;
}) {
  const t = useTranslations("desk.sg.lines");
  const tAll = useTranslations();
  const locale = useLocale() as Locale;
  const number = (value: number) => formatNumber(value, locale);
  const [filter, setFilter] = useState<LinesFilter>(LinesFilter.Attention);
  const flagged = lines.filter(needsAttention);
  const rows = filter === LinesFilter.All ? lines : flagged;
  return (
    <section aria-labelledby="sg-lines" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="sg-lines" className="text-h3 text-ink-strong">
          {t("title")}
        </h2>
        <FilterChips
          label={t("filterLabel")}
          value={filter}
          onChange={setFilter}
          options={[
            {
              value: LinesFilter.Attention,
              label: t("attention", { count: number(flagged.length) }),
            },
            { value: LinesFilter.All, label: t("all", { count: number(lines.length) }) },
          ]}
        />
      </div>
      <DataTable
        caption={t("title")}
        rows={rows}
        empty={
          <p className="flex items-center gap-2 text-body text-success-text">
            <CircleCheck aria-hidden="true" className="size-5" />
            {t("allGood")}
          </p>
        }
        getRowKey={(line) => line.line.line_id}
        columns={[
          {
            key: "line",
            header: t("line"),
            cell: (line) => (
              <div className="flex flex-col">
                {lineHref ? (
                  <Link
                    href={lineHref(line.line.line_id)}
                    className="font-bold text-ink-strong underline-offset-4 hover:underline"
                  >
                    {t("lineValue", { code: line.line.code, name: line.line.name })}
                  </Link>
                ) : (
                  <span className="font-bold text-ink-strong">
                    {t("lineValue", { code: line.line.code, name: line.line.name })}
                  </span>
                )}
                <span className="text-caption text-ink-muted">
                  <bdi>{line.bus.plate}</bdi> · {line.bus.driver_name}
                  {line.replaced ? ` · ${t("replaced")}` : ""}
                </span>
              </div>
            ),
          },
          {
            key: "status",
            header: t("status"),
            cell: (line) => (
              <div className="flex flex-col items-start gap-1">
                <Badge tone={STATUS_TONE[line.status]}>{t(`statuses.${line.status}`)}</Badge>
                {line.delay_minutes ? (
                  <Badge tone={Tone.Warning}>
                    {t("late", { minutes: number(line.delay_minutes) })}
                  </Badge>
                ) : null}
              </div>
            ),
          },
          {
            key: "rode",
            header: t("rode"),
            cell: (line) => <RodeBar rode={line.rode} subscribers={line.subscribers} />,
          },
          {
            key: "notGoing",
            header: t("notGoing"),
            align: "end",
            cell: (line) => number(line.not_going),
          },
          {
            key: "absent",
            header: t("absent"),
            align: "end",
            cell: (line) =>
              line.status === LineDayStatus.Ended ? number(line.absent) : tAll("desk.sg.dash"),
          },
        ]}
      />
    </section>
  );
}

function RodeBar({ rode, subscribers }: { rode: number; subscribers: number }) {
  const t = useTranslations("desk.sg.lines");
  const locale = useLocale() as Locale;
  const share = subscribers ? Math.round((rode / subscribers) * PERCENT) : 0;
  return (
    <div className="flex min-w-36 items-center gap-2">
      <div
        className="h-2 flex-1 overflow-hidden rounded-pill bg-surface-alt"
        role="img"
        aria-label={t("rodeLabel", {
          rode: formatNumber(rode, locale),
          subscribers: formatNumber(subscribers, locale),
        })}
      >
        <div className="h-full rounded-pill bg-teal" style={{ width: `${share}%` }} />
      </div>
      <span className="text-body-sm whitespace-nowrap text-ink tabular-nums" aria-hidden="true">
        {formatNumber(rode, locale)}/{formatNumber(subscribers, locale)}
      </span>
    </div>
  );
}
