"use client";

import { CircleCheck, Clock, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { DataTable, type TableColumn } from "@/components/ui/table";

/** Placeholder rows for the gallery and the frame preview only. Real data comes from lib/api. */
const LineRunStatus = {
  OnTime: "on_time",
  Late: "late",
  NotStarted: "not_started",
} as const;
type LineRunStatus = (typeof LineRunStatus)[keyof typeof LineRunStatus];

interface SampleLine {
  id: string;
  number: number;
  bus_plate: string;
  riders: number;
  capacity: number;
  status: LineRunStatus;
  minutes_late: number;
}

export const SAMPLE_LINES: readonly SampleLine[] = [
  {
    id: "l1",
    number: 1,
    bus_plate: "SU-01",
    riders: 41,
    capacity: 48,
    status: LineRunStatus.OnTime,
    minutes_late: 0,
  },
  {
    id: "l2",
    number: 2,
    bus_plate: "SU-04",
    riders: 37,
    capacity: 48,
    status: LineRunStatus.Late,
    minutes_late: 10,
  },
  {
    id: "l3",
    number: 3,
    bus_plate: "SU-07",
    riders: 45,
    capacity: 48,
    status: LineRunStatus.OnTime,
    minutes_late: 0,
  },
  {
    id: "l4",
    number: 4,
    bus_plate: "SU-12",
    riders: 0,
    capacity: 32,
    status: LineRunStatus.NotStarted,
    minutes_late: 0,
  },
];

interface SampleLinesTableProps {
  isLoading?: boolean;
  rows?: readonly SampleLine[];
  empty?: ReactNode;
}

export function SampleLinesTable({ isLoading, rows = SAMPLE_LINES, empty }: SampleLinesTableProps) {
  const t = useTranslations("preview");

  const statusBadge = (line: SampleLine) => {
    switch (line.status) {
      case LineRunStatus.OnTime:
        return (
          <Badge tone="success" icon={<CircleCheck />}>
            {t("statusOnTime")}
          </Badge>
        );
      case LineRunStatus.Late:
        return (
          <Badge tone="warning" icon={<TriangleAlert />}>
            {t("statusLate", { minutes: line.minutes_late })}
          </Badge>
        );
      case LineRunStatus.NotStarted:
        return <Badge icon={<Clock />}>{t("statusNotStarted")}</Badge>;
    }
  };

  const columns: TableColumn<SampleLine>[] = [
    {
      key: "line",
      header: t("colLine"),
      cell: (line) => (
        <span className="font-bold text-ink-strong">{t("lineName", { number: line.number })}</span>
      ),
    },
    {
      key: "bus",
      header: t("colBus"),
      cell: (line) => (
        <span className="num" dir="ltr">
          {line.bus_plate}
        </span>
      ),
    },
    {
      key: "riders",
      header: t("colRiders"),
      align: "end",
      cell: (line) => `${line.riders} / ${line.capacity}`,
    },
    { key: "status", header: t("colStatus"), cell: statusBadge },
  ];

  return (
    <DataTable
      caption={t("tableCaption")}
      columns={columns}
      rows={rows}
      getRowKey={(line) => line.id}
      isLoading={isLoading}
      empty={empty}
    />
  );
}
