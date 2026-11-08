"use client";

import { CalendarX2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Radio } from "@/components/ui/choice";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { TextField } from "@/components/ui/input";
import { Tone } from "@/components/ui/tone";
import { useToast } from "@/components/ui/toast";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { formatCalendarDate, formatServiceDay, formatTime, todayInCairo } from "@/lib/format";
import { useSubmit } from "@/lib/hooks/use-submit";
import { createAbsence } from "../api";
import {
  ABSENCE_NOTE_MAX_LENGTH,
  ABSENCE_REASONS,
  AbsenceReason,
  type MyAbsences,
} from "../schema";
import { SERVER_ERRORS } from "./not-going-upcoming";

export function ReportForm({ data, onDone }: { data: MyAbsences; onDone: () => void }) {
  const t = useTranslations("student.notGoing");
  const tCommon = useTranslations("common");
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
            optionalText={tCommon("optional")}
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
