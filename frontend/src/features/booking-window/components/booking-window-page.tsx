"use client";

import { CalendarClock, CalendarPlus, CalendarX2, Lock, LockOpen } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { TextField } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { DataTable } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { Tone } from "@/components/ui/tone";
import { DeskListState } from "@/features/desk-kit/components/desk-list-state";
import type { Locale } from "@/i18n/routing";
import { cairoLocalToIso, isoToCairoLocal } from "@/lib/cairo-time";
import { formatDateTime } from "@/lib/format";
import { useAsync } from "@/lib/hooks/use-async";
import { useSubmit } from "@/lib/hooks/use-submit";
import { getBookingWindow, updateBookingWindow } from "../api";
import {
  BookingWindowAction,
  BookingWindowErrorCode,
  BookingWindowStatus,
  NOTE_MAX_LENGTH,
  type BookingWindow,
  type BookingWindowHistoryEntry,
} from "../schema";

const ERRORS = Object.values(BookingWindowErrorCode);

const STATUS_TONE: Record<BookingWindowStatus, Tone> = {
  [BookingWindowStatus.Open]: Tone.Success,
  [BookingWindowStatus.NotOpen]: Tone.Neutral,
  [BookingWindowStatus.Closed]: Tone.Danger,
};

/**
 * The Transportation office's booking window: open booking for a set time, extend it, or close
 * it now. While it is closed nobody can book a seat, even on lines with free seats.
 */
export function BookingWindowPage() {
  const t = useTranslations("bookingWindow.office");
  const state = useAsync((signal) => getBookingWindow({ signal }), []);
  const [action, setAction] = useState<BookingWindowAction | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("lead")} />
      <DeskListState state={state}>
        {(window: BookingWindow) => (
          <>
            <StatusCard window={window} onAction={setAction} />
            <HistoryCard history={window.history} />
            {action ? (
              <ChangeDialog
                key={action}
                action={action}
                window={window}
                onClose={() => setAction(null)}
                onSaved={() => {
                  setAction(null);
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

function StatusCard({
  window,
  onAction,
}: {
  window: BookingWindow;
  onAction: (action: BookingWindowAction) => void;
}) {
  const t = useTranslations("bookingWindow.office");
  const locale = useLocale() as Locale;
  const when = (value: string | null) => (value ? formatDateTime(value, locale) : "—");
  const isOpen = window.status === BookingWindowStatus.Open;
  const hasWindow = window.closes_at !== null;

  return (
    <Card elevation="raised">
      <CardHeader
        title={window.term_name}
        headingLevel={2}
        actions={<Badge tone={STATUS_TONE[window.status]}>{t(`status.${window.status}`)}</Badge>}
      />
      <CardBody className="flex flex-col gap-5">
        <p className="text-body text-ink">{t(`explain.${window.status}`)}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StatTile label={t("opensAt")} value={when(window.opens_at)} icon={<LockOpen />} />
          <StatTile label={t("closesAt")} value={when(window.closes_at)} icon={<Lock />} />
        </div>
        <div className="flex flex-wrap gap-3">
          {hasWindow && window.status !== BookingWindowStatus.NotOpen ? (
            <Button
              iconStart={<CalendarPlus className="size-5" />}
              onClick={() => onAction(BookingWindowAction.Extend)}
            >
              {isOpen ? t("extend") : t("reopen")}
            </Button>
          ) : null}
          {!isOpen ? (
            <Button
              variant={hasWindow ? "secondary" : "primary"}
              iconStart={<CalendarClock className="size-5" />}
              onClick={() => onAction(BookingWindowAction.Open)}
            >
              {window.status === BookingWindowStatus.NotOpen && hasWindow
                ? t("reschedule")
                : t("open")}
            </Button>
          ) : null}
          {hasWindow && window.status !== BookingWindowStatus.Closed ? (
            <Button
              variant="danger"
              iconStart={<CalendarX2 className="size-5" />}
              onClick={() => onAction(BookingWindowAction.Close)}
            >
              {window.status === BookingWindowStatus.NotOpen ? t("cancelPlan") : t("closeNow")}
            </Button>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}

function ChangeDialog({
  action,
  window,
  onClose,
  onSaved,
}: {
  action: BookingWindowAction;
  window: BookingWindow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("bookingWindow.office");
  const tCommon = useTranslations("common");
  const toast = useToast();
  const { submit, isSending, serverError } = useSubmit(ERRORS);
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState(() =>
    action === BookingWindowAction.Extend && window.closes_at
      ? isoToCairoLocal(window.closes_at)
      : "",
  );
  const [note, setNote] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const needsEnd = action !== BookingWindowAction.Close;

  async function save() {
    setFieldError(null);
    const closes = needsEnd ? cairoLocalToIso(closesAt) : null;
    if (needsEnd && !closes) {
      setFieldError(t("errors.closesRequired"));
      return;
    }
    const opens = action === BookingWindowAction.Open && opensAt ? cairoLocalToIso(opensAt) : null;
    const saved = await submit((idempotencyKey) =>
      updateBookingWindow(
        { action, opens_at: opens, closes_at: closes, note: note.trim() || null },
        { idempotencyKey },
      ),
    );
    if (saved) {
      toast.show({ title: t(`saved.${action}`), tone: Tone.Success });
      onSaved();
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t(`dialog.${action}.title`)}
      description={t(`dialog.${action}.body`)}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSending}>
            {tCommon("cancel")}
          </Button>
          <Button
            variant={action === BookingWindowAction.Close ? "danger" : "primary"}
            isLoading={isSending}
            onClick={() => void save()}
          >
            {t(`dialog.${action}.confirm`)}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {action === BookingWindowAction.Open ? (
          <TextField
            type="datetime-local"
            label={t("dialog.opensLabel")}
            hint={t("dialog.opensHint")}
            value={opensAt}
            onChange={(event) => setOpensAt(event.target.value)}
          />
        ) : null}
        {needsEnd ? (
          <TextField
            type="datetime-local"
            label={t("dialog.closesLabel")}
            hint={t("dialog.closesHint")}
            required
            value={closesAt}
            error={fieldError ?? undefined}
            onChange={(event) => setClosesAt(event.target.value)}
          />
        ) : null}
        <TextField
          label={t("dialog.noteLabel")}
          hint={t("dialog.noteHint")}
          maxLength={NOTE_MAX_LENGTH}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
        {serverError ? <Alert tone={Tone.Danger} title={t(`errors.${serverError}`)} /> : null}
      </div>
    </Dialog>
  );
}

function HistoryCard({ history }: { history: readonly BookingWindowHistoryEntry[] }) {
  const t = useTranslations("bookingWindow.office");
  const locale = useLocale() as Locale;
  const when = (value: string | null) => (value ? formatDateTime(value, locale) : "—");
  return (
    <Card>
      <CardHeader title={t("history.title")} headingLevel={2} />
      <CardBody>
        <DataTable
          caption={t("history.title")}
          rows={history}
          getRowKey={(row) => `${row.at}-${row.action}`}
          empty={<p className="text-body-sm text-ink-muted">{t("history.empty")}</p>}
          columns={[
            { key: "at", header: t("history.at"), cell: (row) => when(row.at) },
            {
              key: "action",
              header: t("history.action"),
              cell: (row) => (
                <span className="font-bold">{t(`history.actions.${row.action}`)}</span>
              ),
            },
            { key: "closes", header: t("closesAt"), cell: (row) => when(row.closes_at) },
            { key: "by", header: t("history.by"), cell: (row) => row.by_name },
            { key: "note", header: t("history.note"), cell: (row) => row.note ?? "—" },
          ]}
        />
      </CardBody>
    </Card>
  );
}
