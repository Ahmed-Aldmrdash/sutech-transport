"use client";

import { CalendarX2, Undo2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Radio } from "@/components/ui/choice";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { TextField } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Tone } from "@/components/ui/tone";
import { useToast } from "@/components/ui/toast";
import { getMySubscription } from "@/features/subscriptions/api";
import { SubscriptionStatus } from "@/features/subscriptions/schema";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { formatCalendarDate, formatServiceDay, formatTime, todayInCairo } from "@/lib/format";
import { AsyncStatus, useAsync } from "@/lib/hooks/use-async";
import { useSubmit } from "@/lib/hooks/use-submit";
import { cancelAbsence, createAbsence, listMyAbsences } from "../api";
import {
  ABSENCE_NOTE_MAX_LENGTH,
  ABSENCE_REASONS,
  AbsenceErrorCode,
  AbsenceReason,
  type Absence,
  type MyAbsences,
} from "../schema";

const SERVER_ERRORS = Object.values(AbsenceErrorCode);

/** "Not going today": tells the driver, the supervisor and the guardian before the bus leaves. */
export function NotGoingPage() {
  const t = useTranslations("student.notGoing");
  const state = useAsync(async (signal) => {
    const mine = await getMySubscription({ signal });
    if (mine.subscription?.status !== SubscriptionStatus.Active) return null;
    return listMyAbsences({ signal });
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("lead")} />
      {state.status === AsyncStatus.Loading ? <Skeleton className="h-96 w-full" /> : null}
      {state.status === AsyncStatus.Error ? (
        <ErrorState error={state.error} onRetry={state.reload} />
      ) : null}
      {state.status === AsyncStatus.Success && state.data === null ? (
        <EmptyState
          icon={<CalendarX2 />}
          title={t("needsActiveTitle")}
          description={t("needsActiveBody")}
          action={<ButtonLink href="/student">{t("goHome")}</ButtonLink>}
        />
      ) : null}
      {state.status === AsyncStatus.Success && state.data !== null ? (
        <div className="grid items-start gap-5 desktop:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <ReportForm data={state.data} onDone={state.refresh} />
          <Upcoming items={state.data.upcoming} onChanged={state.refresh} />
        </div>
      ) : null}
    </div>
  );
}

function ReportForm({ data, onDone }: { data: MyAbsences; onDone: () => void }) {
  const t = useTranslations("student.notGoing");
  const locale = useLocale() as Locale;
  const toast = useToast();
  const today = todayInCairo();
  const firstDay = data.reportable_days[0]?.service_date ?? "";
  const [day, setDay] = useState(firstDay);
  const [reason, setReason] = useState<AbsenceReason>(AbsenceReason.Sick);
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const { submit, isSending, serverError } = useSubmit(SERVER_ERRORS);
  const chosen = data.reportable_days.find((item) => item.service_date === day);

  if (data.reportable_days.length === 0) {
    return (
      <Card>
        <CardBody>
          <EmptyState
            icon={<CalendarX2 />}
            title={t("noDaysTitle")}
            description={t("noDaysBody")}
          />
        </CardBody>
      </Card>
    );
  }

  const dayLabel = (date: string) =>
    date === today ? t("today") : formatCalendarDate(date, locale, "full");

  async function send() {
    if (!chosen) return;
    const created = await submit((idempotencyKey) =>
      createAbsence(
        { service_date: chosen.service_date, reason, note: note.trim() || null },
        { idempotencyKey },
      ),
    );
    setConfirming(false);
    if (created) {
      toast.show({
        title: t("sentTitle"),
        description: t("sentBody", { day: dayLabel(created.service_date) }),
        tone: Tone.Success,
      });
      setNote("");
      onDone();
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (chosen) setConfirming(true);
  }

  return (
    <Card elevation="raised">
      <CardBody>
        <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-body-sm font-bold text-ink-strong">{t("whichDay")}</legend>
            <div className="flex flex-wrap gap-2">
              {data.reportable_days.map((item) => {
                const isChosen = item.service_date === day;
                return (
                  <button
                    key={item.service_date}
                    type="button"
                    aria-pressed={isChosen}
                    onClick={() => setDay(item.service_date)}
                    className={cn(
                      "min-h-tap rounded-md border px-3 py-2 text-start text-body-sm focus-ring transition-colors",
                      isChosen
                        ? "border-brand bg-brand-soft font-bold text-brand"
                        : "border-line bg-surface-raised text-ink-strong hover:bg-surface-alt",
                    )}
                  >
                    {item.service_date === today
                      ? t("today")
                      : formatServiceDay(item.service_date, locale)}
                  </button>
                );
              })}
            </div>
            {chosen ? (
              <p className="text-caption text-ink-muted">
                {t("cutoff", { time: formatTime(chosen.cutoff_at, locale) })}
              </p>
            ) : null}
          </fieldset>

          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-body-sm font-bold text-ink-strong">{t("reason")}</legend>
            {ABSENCE_REASONS.map((value) => (
              <Radio
                key={value}
                name="reason"
                value={value}
                label={t(`reasons.${value}`)}
                checked={reason === value}
                onChange={() => setReason(value)}
              />
            ))}
          </fieldset>

          <TextField
            label={t("note")}
            hint={t("noteHint")}
            optionalText={t("optional")}
            maxLength={ABSENCE_NOTE_MAX_LENGTH}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />

          <Alert tone={Tone.Info} title={t("whoKnowsTitle")}>
            {t("whoKnowsBody")}
          </Alert>

          {serverError ? <Alert tone={Tone.Danger} title={t(`errors.${serverError}`)} /> : null}
          <Button type="submit" withArrow className="self-start">
            {t("submit")}
          </Button>
        </form>
      </CardBody>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => void send()}
        isConfirming={isSending}
        title={t("confirmTitle", { day: chosen ? dayLabel(chosen.service_date) : "" })}
        description={t("confirmBody")}
        confirmLabel={t("confirm")}
      />
    </Card>
  );
}

function Upcoming({ items, onChanged }: { items: Absence[]; onChanged: () => void }) {
  const t = useTranslations("student.notGoing");
  return (
    <Card>
      <CardHeader title={t("upcomingTitle")} description={t("upcomingLead")} />
      <CardBody>
        {items.length === 0 ? (
          <p className="text-body-sm text-ink-muted">{t("upcomingEmpty")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((item) => (
              <UpcomingItem key={item.absence_id} item={item} onChanged={onChanged} />
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function UpcomingItem({ item, onChanged }: { item: Absence; onChanged: () => void }) {
  const t = useTranslations("student.notGoing");
  const locale = useLocale() as Locale;
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const { submit, isSending, serverError } = useSubmit(SERVER_ERRORS);
  // The list is re-read after each change; the server refuses a late cancel anyway.
  const [loadedAt] = useState(() => Date.now());
  const canCancel = Date.parse(item.cutoff_at) > loadedAt;
  const day =
    item.service_date === todayInCairo()
      ? t("today")
      : formatCalendarDate(item.service_date, locale, "full");

  async function takeBack() {
    const done = await submit((idempotencyKey) =>
      cancelAbsence(item.absence_id, { idempotencyKey }),
    );
    setConfirming(false);
    if (done) {
      toast.show({ title: t("cancelledTitle"), tone: Tone.Success });
      onChanged();
    }
  }

  return (
    <li className="flex flex-col gap-2 rounded-md border border-line p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-body font-bold text-ink-strong">{day}</p>
          <p className="text-body-sm text-ink">
            {t(`reasons.${item.reason}`)}
            {item.note ? ` · ${item.note}` : ""}
          </p>
        </div>
        {canCancel ? (
          <Button
            variant="secondary"
            size="sm"
            iconStart={<Undo2 className="size-4" />}
            onClick={() => setConfirming(true)}
          >
            {t("cancel")}
          </Button>
        ) : null}
      </div>
      {serverError ? <Alert tone={Tone.Danger} title={t(`errors.${serverError}`)} /> : null}
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => void takeBack()}
        isConfirming={isSending}
        title={t("cancelConfirmTitle", { day })}
        description={t("cancelConfirmBody")}
        confirmLabel={t("cancelConfirm")}
        cancelLabel={t("keep")}
      />
    </li>
  );
}
