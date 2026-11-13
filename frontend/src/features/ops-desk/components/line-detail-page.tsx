"use client";

import { Armchair, Bus, Users } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { BackLink } from "@/components/ui/back-link";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { TextField } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/table";
import { DeskListState } from "@/features/desk-kit/components/desk-list-state";
import { CallLink, Fact } from "@/features/emergencies/components/sos-facts";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatClockTime, formatNumber, todayInCairo } from "@/lib/format";
import { useAsync } from "@/lib/hooks/use-async";
import { getOpsLine } from "../api";
import type { OpsLineDetail } from "../schema";
import { ChangeCrewButton } from "./change-crew-button";

/** One line: its bus and driver, stops, and every subscriber by stop. */
export function LineDetailPage({ lineId }: { lineId: string }) {
  const t = useTranslations("desk.ops.lines");
  const state = useAsync((signal) => getOpsLine(lineId, { signal }), [lineId]);
  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/admin/lines">{t("back")}</BackLink>
      <DeskListState state={state}>
        {(line: OpsLineDetail) => <LineDetail line={line} onChanged={state.refresh} />}
      </DeskListState>
    </div>
  );
}

function LineDetail({ line, onChanged }: { line: OpsLineDetail; onChanged: () => void }) {
  const t = useTranslations("desk.ops.lines");
  const tAll = useTranslations();
  const locale = useLocale() as Locale;
  const number = (value: number) => formatNumber(value, locale);
  const time = (value: string | null) => (value ? formatClockTime(value, locale) : "—");
  return (
    <>
      <PageHeader
        title={t("lineValue", { code: line.line.code, name: line.line.name })}
        actions={
          <>
            <ButtonLink
              href={`/admin/attendance?line=${line.line.line_id}&date=${todayInCairo()}`}
              variant="secondary"
            >
              {t("whoRode")}
            </ButtonLink>
            {line.today_trip_id ? (
              <ChangeCrewButton tripId={line.today_trip_id} onChanged={onChanged} />
            ) : null}
          </>
        }
      />
      <Card elevation="raised">
        <CardBody>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Fact label={t("bus")} icon={<Bus />}>
              <bdi>{line.bus.plate}</bdi> ·{" "}
              {tAll("desk.events.typeSeats", {
                type: tAll(`student.busType.${line.bus.bus_type}`),
                seats: number(line.bus.seats),
              })}
            </Fact>
            <Fact label={t("driver")}>
              <CallLink name={line.bus.driver_name} phone={line.bus.driver_phone} />
            </Fact>
            <Fact label={t("riders")} icon={<Armchair />}>
              {t("ridersValue", {
                subscribers: number(line.subscribers),
                seats: number(line.bus.seats),
                free: number(line.seats_free),
              })}
            </Fact>
          </dl>
        </CardBody>
      </Card>
      <DataTable
        caption={t("stopsTitle")}
        rows={line.stops_list}
        getRowKey={(stop) => String(stop.order)}
        columns={[
          { key: "order", header: "#", cell: (stop) => number(stop.order) },
          { key: "name", header: t("stop"), cell: (stop) => stop.name },
          { key: "time", header: t("pickup"), cell: (stop) => time(stop.pickup_time) },
          {
            key: "riders",
            header: t("ridersAtStop"),
            align: "end",
            cell: (stop) => number(stop.subscribers),
          },
        ]}
      />
      <Students line={line} />
    </>
  );
}

function Students({ line }: { line: OpsLineDetail }) {
  const t = useTranslations("desk.ops.lines");
  const locale = useLocale() as Locale;
  const [search, setSearch] = useState("");
  const needle = search.trim().toLowerCase();
  const shown = line.students.filter(
    (student) =>
      !needle || student.identifier.includes(needle) || student.name.toLowerCase().includes(needle),
  );
  return (
    <Card>
      <CardHeader
        title={t("studentsTitle", { count: formatNumber(line.students.length, locale) })}
        headingLevel={2}
        actions={<Users aria-hidden="true" className="size-5 text-teal" />}
      />
      <CardBody className="flex flex-col gap-4">
        <TextField
          type="search"
          label={t("searchStudent")}
          value={search}
          containerClassName="w-full max-w-sm"
          onChange={(event) => setSearch(event.target.value)}
        />
        <DataTable
          caption={t("studentsCaption")}
          rows={shown}
          getRowKey={(student) => student.student_id}
          empty={t("noStudentMatch")}
          columns={[
            {
              key: "name",
              header: t("student"),
              cell: (student) => (
                <Link
                  href={`/admin/students/${student.student_id}`}
                  className="font-bold text-brand underline-offset-4 focus-ring hover:underline"
                >
                  {student.name}
                </Link>
              ),
            },
            {
              key: "id",
              header: t("universityId"),
              cell: (student) => <bdi className="tabular-nums">{student.identifier}</bdi>,
            },
            {
              key: "stop",
              header: t("stop"),
              cell: (student) =>
                student.pickup_time
                  ? t("stopValue", {
                      stop: student.stop_name,
                      time: formatClockTime(student.pickup_time, locale),
                    })
                  : student.stop_name,
            },
          ]}
        />
      </CardBody>
    </Card>
  );
}
