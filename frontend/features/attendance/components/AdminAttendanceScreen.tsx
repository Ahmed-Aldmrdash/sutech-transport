"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { Async } from "@/components/ui/Async";
import { Field, Input, Select } from "@/components/ui/Field";
import { Pill, type Tone } from "@/components/ui/Pill";
import { StatCard } from "@/components/ui/StatCard";
import { type Column, Table } from "@/components/ui/Table";
import { listLines } from "@/features/lines/api";
import { useApi, usePolling } from "@/lib/api/use-api";
import { cairoDate, formatTime } from "@/lib/time";
import { getAttendance } from "../api";
import type { AttendanceSummary } from "../schema";

type Row = AttendanceSummary["rows"][number];
type Status = Row["status"];
const STATUSES: Status[] = ["arrived", "on_bus", "waiting", "skipped", "checked_out", "absent"];
const TONE: Record<Status, Tone> = { arrived: "success", on_bus: "teal", waiting: "neutral", skipped: "brand", checked_out: "warning", absent: "danger" };
const REFRESH_MS = 15_000;

export function AdminAttendanceScreen() {
  const t = useTranslations("admin.attendance");
  const locale = useLocale();
  const [date, setDate] = useState(cairoDate());
  const [lineId, setLineId] = useState("");
  const lines = useApi(listLines);
  const query = useApi(() => getAttendance(date, lineId || undefined), [date, lineId]);
  usePolling(query.reload, REFRESH_MS);

  const columns: Column<Row>[] = [
    { key: "name", header: t("student"), cell: (row) => <span className="font-bold text-ink-strong">{row.student_name}</span> },
    { key: "id", header: t("id"), cell: (row) => <span className="num">{row.student_id}</span> },
    { key: "line", header: t("line"), cell: (row) => row.line_name },
    { key: "status", header: t("status"), cell: (row) => <Pill tone={TONE[row.status]}>{t(`statuses.${row.status}`)}</Pill> },
    { key: "at", header: t("at"), cell: (row) => (row.at ? <span className="num">{formatTime(row.at, locale)}</span> : "—") },
    { key: "detail", header: t("detail"), cell: (row) => row.detail ?? "" },
  ];

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:max-w-xl">
        <Field label={t("date")}>{(props) => <Input {...props} type="date" value={date} max={cairoDate()} onChange={(event) => setDate(event.target.value || cairoDate())} />}</Field>
        <Field label={t("line")}>
          {(props) => (
            <Select {...props} value={lineId} onChange={(event) => setLineId(event.target.value)}>
              <option value="">{t("allLines")}</option>
              {(lines.data?.items ?? []).map((line) => (
                <option key={line.id} value={line.id}>
                  {line.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <Async query={query}>
        {(data) => (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              {STATUSES.map((status) => (
                <StatCard key={status} label={t(`statuses.${status}`)} value={data.totals[status]} />
              ))}
            </div>
            <Table rows={data.rows} columns={columns} rowKey={(row) => row.student_id} caption={t("title")} empty={t("empty")} />
          </div>
        )}
      </Async>
    </>
  );
}
