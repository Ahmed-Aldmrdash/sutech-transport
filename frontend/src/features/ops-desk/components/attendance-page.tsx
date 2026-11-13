"use client";

import { CalendarX, CircleCheck, LogOut, UserX, CalendarX2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChips } from "@/components/ui/filter-chips";
import { TextField } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { SelectField } from "@/components/ui/select-field";
import { StatTile } from "@/components/ui/stat-tile";
import { DataTable } from "@/components/ui/table";
import { RiderStateBadge } from "@/features/crew/components/rider-state-badge";
import { TestDayButton } from "@/features/crew/components/test-day-button";
import { RiderState, type Rider } from "@/features/crew/schema";
import { DeskListState } from "@/features/desk-kit/components/desk-list-state";
import { SG_DAYS_BACK_MAX } from "@/features/sg-office/schema";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import {
  addCalendarDays,
  formatCalendarDate,
  formatClockTime,
  formatNumber,
  formatTime,
  todayInCairo,
} from "@/lib/format";
import { AsyncStatus, useAsync } from "@/lib/hooks/use-async";
import { getLineAttendance, listOpsLines } from "../api";
import type { LineAttendance } from "../schema";

type StateFilter = "all" | RiderState;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Who rode one line's morning trip on one day, rider by rider. */
export function AttendancePage() {
  const t = useTranslations("desk.ops.attendance");
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const today = todayInCairo();
  const askedDate = params.get("date") ?? "";
  const [chosenLine, setLineId] = useState(params.get("line") ?? "");
  const [date, setDate] = useState(
    DATE_PATTERN.test(askedDate) && askedDate <= today ? askedDate : today,
  );
  const lines = useAsync((signal) => listOpsLines({ signal }), []);
  // With no line in the address, show the first line the server lists (never a guessed id).
  const firstLine =
    lines.status === AsyncStatus.Success ? (lines.data.items[0]?.line.line_id ?? "") : "";
  const lineId = chosenLine || firstLine;
  const linesError = lines.status === AsyncStatus.Error ? lines.error : undefined;
  const state = useAsync(
    (signal) =>
      lineId
        ? getLineAttendance({ line_id: lineId, date }, { signal })
        : linesError
          ? Promise.reject(linesError)
          : new Promise<never>(() => undefined),
    [lineId, date, linesError],
  );

  function choose(next: { line?: string; date?: string }) {
    const line = next.line ?? lineId;
    const day = next.date ?? date;
    setLineId(line);
    setDate(day);
    router.replace(`${pathname}?line=${line}&date=${day}`, { scroll: false });
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("lead")} />
      <div className="flex flex-wrap items-end gap-3">
        <SelectField
          label={t("line")}
          value={lineId}
          containerClassName="w-full max-w-sm"
          onChange={(event) => choose({ line: event.target.value })}
          options={
            lines.status === AsyncStatus.Success
              ? lines.data.items.map((item) => ({
                  value: item.line.line_id,
                  label: t("lineValue", { code: item.line.code, name: item.line.name }),
                }))
              : [{ value: lineId, label: t("loadingLines") }]
          }
        />
        <TextField
          type="date"
          label={t("day")}
          min={addCalendarDays(today, -SG_DAYS_BACK_MAX)}
          max={today}
          value={date}
          containerClassName="w-full max-w-xs"
          onChange={(event) => {
            const value = event.target.value;
            if (value) choose({ date: value > today ? today : value });
          }}
        />
      </div>
      <DeskListState state={state}>
        {(attendance: LineAttendance) => (
          <Roster attendance={attendance} onTestDay={state.reload} />
        )}
      </DeskListState>
    </div>
  );
}

function Roster({ attendance, onTestDay }: { attendance: LineAttendance; onTestDay: () => void }) {
  const t = useTranslations("desk.ops.attendance");
  const locale = useLocale() as Locale;
  const [filter, setFilter] = useState<StateFilter>("all");
  const number = (value: number) => formatNumber(value, locale);
  const { counts } = attendance;

  if (!attendance.is_service_day) {
    return (
      <EmptyState
        icon={<CalendarX />}
        title={t("noService")}
        description={t("noServiceBody")}
        action={attendance.date === todayInCairo() ? <TestDayButton onStarted={onTestDay} /> : null}
      />
    );
  }
  const rows = attendance.riders.filter((rider) => filter === "all" || rider.state === filter);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-caption text-ink-muted">
        {t("tripOn", {
          date: formatCalendarDate(attendance.date, locale, "full"),
          status: t(`tripStatus.${attendance.trip_status ?? "not_started"}`),
        })}
      </p>
      <div className="grid grid-cols-2 gap-3 desktop:grid-cols-4">
        <StatTile
          label={t("boarded")}
          value={number(counts.boarded + counts.checked_out)}
          caption={t("ofTotal", { count: number(counts.total) })}
          icon={<CircleCheck />}
        />
        <StatTile label={t("leftEarly")} value={number(counts.checked_out)} icon={<LogOut />} />
        <StatTile label={t("notGoing")} value={number(counts.not_going)} icon={<CalendarX2 />} />
        <StatTile
          label={t("absent")}
          value={number(counts.absent)}
          caption={counts.waiting ? t("stillWaiting", { count: number(counts.waiting) }) : null}
          icon={<UserX />}
        />
      </div>
      <FilterChips
        label={t("filterLabel")}
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: t("all", { count: number(counts.total) }) },
          ...Object.values(RiderState).map((state) => ({
            value: state,
            label: t(`states.${state}`, {
              count: number(attendance.riders.filter((rider) => rider.state === state).length),
            }),
          })),
        ]}
      />
      <RiderTable rows={rows} />
    </div>
  );
}

function RiderTable({ rows }: { rows: Rider[] }) {
  const t = useTranslations("desk.ops.attendance");
  const tAll = useTranslations();
  const locale = useLocale() as Locale;
  function detail(rider: Rider): string {
    if (rider.state === RiderState.CheckedOut && rider.checked_out_at) {
      return t("leftAt", {
        time: formatTime(rider.checked_out_at, locale),
        reason: rider.checkout_reason ? tAll(`crew.checkout.reasons.${rider.checkout_reason}`) : "",
      });
    }
    if (rider.boarded_at) return t("boardedAt", { time: formatTime(rider.boarded_at, locale) });
    if (rider.state === RiderState.NotGoing && rider.not_going_reason) {
      return tAll(`student.notGoing.reasons.${rider.not_going_reason}`);
    }
    return "";
  }
  return (
    <DataTable
      caption={t("rosterCaption")}
      rows={rows}
      getRowKey={(rider) => rider.student_id}
      empty={t("noneInFilter")}
      columns={[
        {
          key: "name",
          header: t("student"),
          cell: (rider) => (
            <span className="flex flex-col">
              <Link
                href={`/admin/students/${rider.student_id}`}
                className="font-bold text-brand underline-offset-4 focus-ring hover:underline"
              >
                {rider.name}
              </Link>
              <bdi className="text-caption text-ink-muted tabular-nums">{rider.identifier}</bdi>
            </span>
          ),
        },
        {
          key: "stop",
          header: t("stop"),
          cell: (rider) =>
            rider.pickup_time
              ? t("stopValue", {
                  stop: rider.stop_name,
                  time: formatClockTime(rider.pickup_time, locale),
                })
              : rider.stop_name,
        },
        {
          key: "state",
          header: t("state"),
          cell: (rider) => (
            <span className="flex flex-col items-start gap-1">
              <RiderStateBadge state={rider.state} />
              <span className="text-caption text-ink-muted">{detail(rider)}</span>
            </span>
          ),
        },
      ]}
    />
  );
}
