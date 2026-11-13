"use client";

import { Clock, Route, Undo2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { TextField } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { DataTable } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { Tone } from "@/components/ui/tone";
import { DeskListState } from "@/features/desk-kit/components/desk-list-state";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatArrival, formatClockTime, formatDateTime, formatNumber } from "@/lib/format";
import { AsyncStatus, useAsync } from "@/lib/hooks/use-async";
import { useSubmit } from "@/lib/hooks/use-submit";
import { changeReturnTime, getTimetable } from "../api";
import { TimetableErrorCode, type Timetable, type TimetableRow } from "../schema";

const ERRORS = Object.values(TimetableErrorCode);
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Every line: null. One line: that row. */
type Editing = { row: TimetableRow | null } | null;

/** When each bus reaches campus and when it leaves: one time for all lines, or one line's own. */
export function ReturnTimesPage() {
  const t = useTranslations("desk.ops.returnTimes");
  const state = useAsync((signal) => getTimetable({ signal }), []);
  const [editing, setEditing] = useState<Editing>(null);
  const [search, setSearch] = useState("");
  const needle = search.trim().toLowerCase();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        description={t("lead")}
        actions={
          state.status === AsyncStatus.Success ? (
            <Button
              iconStart={<Undo2 className="size-5" />}
              onClick={() => setEditing({ row: null })}
            >
              {t("changeAll")}
            </Button>
          ) : null
        }
      />
      <DeskListState state={state}>
        {(timetable: Timetable) => (
          <>
            <Summary timetable={timetable} />
            <TextField
              type="search"
              label={t("search")}
              value={search}
              containerClassName="w-full max-w-sm"
              onChange={(event) => setSearch(event.target.value)}
            />
            <TimesTable
              rows={timetable.items.filter(
                ({ line }) =>
                  !needle ||
                  line.code.toLowerCase().includes(needle) ||
                  line.name.toLowerCase().includes(needle),
              )}
              onChange={(row) => setEditing({ row })}
            />
            {editing ? (
              <ChangeDialog
                timetable={timetable}
                row={editing.row}
                onClose={() => setEditing(null)}
                onSaved={() => {
                  setEditing(null);
                  state.refresh();
                }}
              />
            ) : null}
          </>
        )}
      </DeskListState>
    </div>
  );
}

function Summary({ timetable }: { timetable: Timetable }) {
  const t = useTranslations("desk.ops.returnTimes");
  const locale = useLocale() as Locale;
  const first = timetable.items[0];
  const others = timetable.items.filter(
    (row) => row.return_departure_time !== timetable.default_return_time,
  ).length;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <StatTile
        label={t("arrival")}
        value={first ? formatArrival(first.campus_arrival, locale) : "—"}
        caption={t("arrivalCaption")}
        icon={<Clock />}
      />
      <StatTile
        label={t("leaves")}
        value={formatClockTime(timetable.default_return_time, locale)}
        caption={t("leavesCaption")}
        icon={<Undo2 />}
      />
      <StatTile
        label={t("otherTime")}
        value={formatNumber(others, locale)}
        caption={t("otherTimeCaption", { total: formatNumber(timetable.items.length, locale) })}
        icon={<Route />}
      />
    </div>
  );
}

function TimesTable({
  rows,
  onChange,
}: {
  rows: TimetableRow[];
  onChange: (row: TimetableRow) => void;
}) {
  const t = useTranslations("desk.ops.returnTimes");
  const locale = useLocale() as Locale;
  return (
    <DataTable
      caption={t("title")}
      rows={rows}
      getRowKey={(row) => row.line.line_id}
      empty={t("noMatch")}
      columns={[
        {
          key: "line",
          header: t("line"),
          cell: (row) => (
            <Link
              href={`/admin/lines/${row.line.line_id}`}
              className="font-bold text-brand underline-offset-4 focus-ring hover:underline"
            >
              {t("lineValue", { code: row.line.code, name: row.line.name })}
            </Link>
          ),
        },
        {
          key: "pickup",
          header: t("firstPickup"),
          cell: (row) =>
            row.first_pickup_time ? formatClockTime(row.first_pickup_time, locale) : "—",
        },
        {
          key: "arrival",
          header: t("arrival"),
          cell: (row) => formatArrival(row.campus_arrival, locale),
        },
        {
          key: "return",
          header: t("leaves"),
          cell: (row) => (
            <span className="flex flex-col">
              <span className="font-bold text-ink-strong">
                {formatClockTime(row.return_departure_time, locale)}
              </span>
              {row.changed_by_name && row.changed_at ? (
                <span className="text-caption text-ink-muted">
                  {t("changedBy", {
                    name: row.changed_by_name,
                    when: formatDateTime(row.changed_at, locale),
                  })}
                </span>
              ) : null}
            </span>
          ),
        },
        {
          key: "action",
          header: <span className="sr-only">{t("actions")}</span>,
          cell: (row) => (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onChange(row)}
              aria-label={t("changeLine", { code: row.line.code })}
            >
              {t("change")}
            </Button>
          ),
        },
      ]}
    />
  );
}

function ChangeDialog({
  timetable,
  row,
  onClose,
  onSaved,
}: {
  timetable: Timetable;
  row: TimetableRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("desk.ops.returnTimes");
  const locale = useLocale() as Locale;
  const toast = useToast();
  const [time, setTime] = useState(row?.return_departure_time ?? timetable.default_return_time);
  const [error, setError] = useState<string | undefined>();
  const { submit, isSending, serverError } = useSubmit(ERRORS);

  async function onConfirm() {
    if (!CLOCK.test(time)) {
      setError(t("timeError"));
      return;
    }
    const saved = await submit((idempotencyKey) =>
      changeReturnTime(
        { line_ids: row ? [row.line.line_id] : [], return_departure_time: time },
        { idempotencyKey },
      ),
    );
    if (!saved) return;
    toast.show({
      title: t("saved", { time: formatClockTime(time, locale) }),
      tone: Tone.Success,
    });
    onSaved();
  }

  return (
    <ConfirmDialog
      open
      onClose={onClose}
      onConfirm={() => void onConfirm()}
      isConfirming={isSending}
      title={row ? t("lineTitle", { code: row.line.code, name: row.line.name }) : t("allTitle")}
      description={row ? t("lineBody") : t("allBody", { total: timetable.items.length })}
      confirmLabel={t("save")}
    >
      <div className="flex flex-col gap-4">
        <TextField
          type="time"
          label={t("leavesAt")}
          required
          dir="ltr"
          value={time}
          error={error}
          onChange={(event) => {
            setTime(event.target.value);
            setError(undefined);
          }}
        />
        {serverError ? <Alert tone={Tone.Danger} title={t(`errors.${serverError}`)} /> : null}
      </div>
    </ConfirmDialog>
  );
}
