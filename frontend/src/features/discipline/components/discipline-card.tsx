"use client";

import { Ban, CircleOff, ShieldAlert, TriangleAlert, Undo2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { TextAreaField, TextField } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { Tone } from "@/components/ui/tone";
import { ErrorState } from "@/components/ui/error-state";
import type { Locale } from "@/i18n/routing";
import { formatCalendarDate, formatDateTime, todayInCairo, addCalendarDays } from "@/lib/format";
import { AsyncStatus, useAsync } from "@/lib/hooks/use-async";
import { useSubmit } from "@/lib/hooks/use-submit";
import { createDiscipline, getStudentStanding, liftDiscipline } from "../api";
import {
  DISCIPLINE_REASON_MAX,
  DISCIPLINE_REASON_MIN,
  DisciplineAction,
  DisciplineErrorCode,
  MAX_SUSPENSION_DAYS,
  Standing,
  type DisciplineRecord,
} from "../schema";
import { StandingBadge } from "./standing-badge";

const ERRORS = Object.values(DisciplineErrorCode);

const ACTION_ICON = {
  [DisciplineAction.Warning]: <TriangleAlert />,
  [DisciplineAction.Suspension]: <CircleOff />,
  [DisciplineAction.Ban]: <Ban />,
} as const;

type Dialogs =
  { kind: "create"; action: DisciplineAction } | { kind: "lift"; record: DisciplineRecord };

/**
 * Warn, suspend or ban a student, and lift a suspension or ban early. On the student's page for
 * the Transportation office, Student Affairs and the super admin.
 */
export function DisciplineCard({
  studentId,
  studentName,
}: {
  studentId: string;
  studentName: string;
}) {
  const t = useTranslations("discipline.office");
  const state = useAsync((signal) => getStudentStanding(studentId, { signal }), [studentId]);
  const [dialog, setDialog] = useState<Dialogs | null>(null);

  return (
    <Card>
      <CardHeader
        title={t("title")}
        description={t("lead")}
        headingLevel={2}
        actions={
          state.status === AsyncStatus.Success ? (
            <StandingBadge standing={state.data.standing} showGood />
          ) : null
        }
      />
      <CardBody className="flex flex-col gap-4">
        {state.status === AsyncStatus.Loading ? <Skeleton className="h-24 w-full" /> : null}
        {state.status === AsyncStatus.Error ? (
          <ErrorState error={state.error} onRetry={state.reload} />
        ) : null}
        {state.status === AsyncStatus.Success ? (
          <>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                iconStart={<TriangleAlert />}
                onClick={() => setDialog({ kind: "create", action: DisciplineAction.Warning })}
              >
                {t("warn")}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                iconStart={<CircleOff />}
                onClick={() => setDialog({ kind: "create", action: DisciplineAction.Suspension })}
              >
                {t("suspend")}
              </Button>
              <Button
                variant="danger"
                size="sm"
                iconStart={<Ban />}
                disabled={state.data.standing === Standing.Banned}
                onClick={() => setDialog({ kind: "create", action: DisciplineAction.Ban })}
              >
                {t("ban")}
              </Button>
            </div>
            <RecordList
              records={state.data.records}
              onLift={(record) => setDialog({ kind: "lift", record })}
            />
          </>
        ) : null}
      </CardBody>
      {dialog?.kind === "create" ? (
        <CreateDialog
          key={dialog.action}
          studentId={studentId}
          studentName={studentName}
          action={dialog.action}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            state.refresh();
          }}
        />
      ) : null}
      {dialog?.kind === "lift" ? (
        <LiftDialog
          record={dialog.record}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            state.refresh();
          }}
        />
      ) : null}
    </Card>
  );
}

function RecordList({
  records,
  onLift,
}: {
  records: readonly DisciplineRecord[];
  onLift: (record: DisciplineRecord) => void;
}) {
  const t = useTranslations("discipline.office");
  const locale = useLocale() as Locale;
  if (records.length === 0) {
    return (
      <p className="flex items-center gap-2 text-body-sm text-ink-muted">
        <ShieldAlert aria-hidden="true" className="size-4" />
        {t("empty")}
      </p>
    );
  }
  return (
    <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
      {records.map((record) => {
        const liftable = record.in_force && record.action !== DisciplineAction.Warning;
        return (
          <li key={record.record_id} className="flex flex-wrap items-start gap-3 p-3">
            <span
              aria-hidden="true"
              className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-sm bg-surface-alt text-ink [&_svg]:size-4"
            >
              {ACTION_ICON[record.action]}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-body-sm font-bold text-ink-strong">
                {t(`actions.${record.action}`)}
                {record.ends_on
                  ? ` · ${t("until", { day: formatCalendarDate(record.ends_on, locale) })}`
                  : null}
                {record.lifted_at ? (
                  <Badge tone={Tone.Neutral}>{t("lifted")}</Badge>
                ) : record.in_force && record.action !== DisciplineAction.Warning ? (
                  <Badge tone={Tone.Danger}>{t("inForce")}</Badge>
                ) : null}
              </p>
              <p className="text-body-sm text-ink">{record.reason}</p>
              <p className="text-caption text-ink-muted">
                {t("byAt", { name: record.by_name, at: formatDateTime(record.created_at, locale) })}
              </p>
              {record.lifted_at ? (
                <p className="text-caption text-ink-muted">
                  {t("liftedByAt", {
                    name: record.lifted_by_name ?? "",
                    at: formatDateTime(record.lifted_at, locale),
                    note: record.lift_note ?? "",
                  })}
                </p>
              ) : null}
            </div>
            {liftable ? (
              <Button
                variant="secondary"
                size="sm"
                iconStart={<Undo2 />}
                onClick={() => onLift(record)}
              >
                {t("lift")}
              </Button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function CreateDialog({
  studentId,
  studentName,
  action,
  onClose,
  onSaved,
}: {
  studentId: string;
  studentName: string;
  action: DisciplineAction;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("discipline.office");
  const tCommon = useTranslations("common");
  const toast = useToast();
  const today = todayInCairo();
  const [reason, setReason] = useState("");
  const [endsOn, setEndsOn] = useState(() => addCalendarDays(today, 7));
  const [fieldError, setFieldError] = useState<string | null>(null);
  const { submit, isSending, serverError } = useSubmit(ERRORS);
  const isSuspension = action === DisciplineAction.Suspension;

  async function save() {
    setFieldError(null);
    if (reason.trim().length < DISCIPLINE_REASON_MIN) {
      setFieldError(t("errors.reasonShort", { min: DISCIPLINE_REASON_MIN }));
      return;
    }
    const saved = await submit((idempotencyKey) =>
      createDiscipline(
        studentId,
        { action, reason: reason.trim(), ends_on: isSuspension ? endsOn : null },
        { idempotencyKey },
      ),
    );
    if (saved) {
      toast.show({ title: t(`saved.${action}`, { name: studentName }), tone: Tone.Success });
      onSaved();
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t(`dialog.${action}.title`, { name: studentName })}
      description={t(`dialog.${action}.body`)}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSending}>
            {tCommon("cancel")}
          </Button>
          <Button
            variant={action === DisciplineAction.Warning ? "primary" : "danger"}
            isLoading={isSending}
            onClick={() => void save()}
          >
            {t(`dialog.${action}.confirm`)}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <TextAreaField
          label={t("dialog.reason")}
          hint={t("dialog.reasonHint")}
          required
          rows={3}
          maxLength={DISCIPLINE_REASON_MAX}
          value={reason}
          error={fieldError ?? undefined}
          onChange={(event) => setReason(event.target.value)}
        />
        {isSuspension ? (
          <TextField
            type="date"
            label={t("dialog.endsOn")}
            hint={t("dialog.endsOnHint", { days: MAX_SUSPENSION_DAYS })}
            required
            min={addCalendarDays(today, 1)}
            max={addCalendarDays(today, MAX_SUSPENSION_DAYS)}
            value={endsOn}
            onChange={(event) => setEndsOn(event.target.value)}
          />
        ) : null}
        {serverError ? <Alert tone={Tone.Danger} title={t(`errors.${serverError}`)} /> : null}
      </div>
    </Dialog>
  );
}

function LiftDialog({
  record,
  onClose,
  onSaved,
}: {
  record: DisciplineRecord;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("discipline.office");
  const tCommon = useTranslations("common");
  const toast = useToast();
  const [note, setNote] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const { submit, isSending, serverError } = useSubmit(ERRORS);

  async function save() {
    setFieldError(null);
    if (note.trim().length < DISCIPLINE_REASON_MIN) {
      setFieldError(t("errors.reasonShort", { min: DISCIPLINE_REASON_MIN }));
      return;
    }
    const saved = await submit((idempotencyKey) =>
      liftDiscipline(record.record_id, { note: note.trim() }, { idempotencyKey }),
    );
    if (saved) {
      toast.show({ title: t("liftedToast"), tone: Tone.Success });
      onSaved();
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t("liftTitle", { what: t(`actions.${record.action}`) })}
      description={t("liftBody")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSending}>
            {tCommon("cancel")}
          </Button>
          <Button isLoading={isSending} onClick={() => void save()}>
            {t("lift")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <TextAreaField
          label={t("liftNote")}
          required
          rows={3}
          maxLength={DISCIPLINE_REASON_MAX}
          value={note}
          error={fieldError ?? undefined}
          onChange={(event) => setNote(event.target.value)}
        />
        {serverError ? <Alert tone={Tone.Danger} title={t(`errors.${serverError}`)} /> : null}
      </div>
    </Dialog>
  );
}
