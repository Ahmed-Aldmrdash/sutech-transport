"use client";

import { Send } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { BackLink } from "@/components/ui/back-link";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { TextAreaField, TextField } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { SelectField } from "@/components/ui/select-field";
import { useToast } from "@/components/ui/toast";
import { Tone } from "@/components/ui/tone";
import { BusType } from "@/features/lines/schema";
import { useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { focusFirstError } from "@/lib/forms/focus-first-error";
import { addCalendarDays, formatNumber, todayInCairo } from "@/lib/format";
import { useSubmit } from "@/lib/hooks/use-submit";
import {
  EMPTY_EVENT_FORM,
  suggestedBuses,
  toCount,
  toCreateEventBody,
  validateEventForm,
  type EventFormError,
  type EventFormField,
  type EventFormValues,
} from "../event-form";
import { createEvent } from "../api";
import {
  EVENT_DAYS_AHEAD_MAX,
  EVENT_KINDS,
  EVENT_NOTE_MAX_LENGTH,
  EVENT_PLACE_MAX_LENGTH,
  EVENT_SEATS_BY_BUS,
  EVENT_TITLE_MAX_LENGTH,
  EventErrorCode,
  type EventKind,
} from "../schema";

const ERRORS = Object.values(EventErrorCode);
const BUS_TYPES = [BusType.LargeBus, BusType.Midibus, BusType.Coaster, BusType.Minibus] as const;

/** Ask Abu El Hol for buses: what, when, where, how many students. */
export function NewEventPage() {
  const t = useTranslations("desk.events.form");
  const tAll = useTranslations();
  const tErrors = useTranslations("desk.events.errors");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const toast = useToast();
  const [values, setValues] = useState<EventFormValues>(EMPTY_EVENT_FORM);
  const [errors, setErrors] = useState<Partial<Record<EventFormField, EventFormError>>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const { submit, isSending, serverError } = useSubmit(ERRORS);
  const today = todayInCairo();
  const suggested = suggestedBuses(toCount(values.students), values.busType);

  function update<K extends EventFormField>(key: K, value: EventFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  /** The field's message, with its numbers in the page's digits. */
  function errorOf(field: EventFormField): string | undefined {
    const error = errors[field];
    if (!error) return undefined;
    switch (error.key) {
      case "studentsRequired":
      case "busesRequired":
        return t(error.key, { max: formatNumber(error.max, locale) });
      case "notEnoughSeats":
        return t(error.key, { count: formatNumber(error.count, locale) });
      default:
        return t(error.key);
    }
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    const next = validateEventForm(values, today);
    setErrors(next);
    if (Object.keys(next).length > 0) {
      focusFirstError(formRef.current);
      return;
    }
    const created = await submit((idempotencyKey) =>
      createEvent(toCreateEventBody(values), { idempotencyKey }),
    );
    if (!created) return;
    toast.show({ title: t("sent"), tone: Tone.Success });
    router.replace(`/admin/events/${encodeURIComponent(created.event_id)}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/admin/events">{tAll("desk.events.back")}</BackLink>
      <PageHeader title={t("title")} description={t("lead")} />
      <Card elevation="raised">
        <CardBody>
          <form
            ref={formRef}
            noValidate
            onSubmit={(event) => void send(event)}
            className="flex flex-col gap-5"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <SelectField
                label={t("kind")}
                required
                value={values.kind}
                options={EVENT_KINDS.map((kind) => ({
                  value: kind,
                  label: tAll(`desk.events.kinds.${kind}`),
                }))}
                onChange={(event) => update("kind", event.target.value as EventKind)}
              />
              <TextField
                label={t("eventTitle")}
                hint={t("eventTitleHint")}
                required
                maxLength={EVENT_TITLE_MAX_LENGTH}
                value={values.title}
                error={errorOf("title")}
                onChange={(event) => update("title", event.target.value)}
              />
              <TextField
                type="date"
                label={t("date")}
                hint={t("dateHint")}
                required
                min={addCalendarDays(today, 1)}
                max={addCalendarDays(today, EVENT_DAYS_AHEAD_MAX)}
                value={values.date}
                error={errorOf("date")}
                onChange={(event) => update("date", event.target.value)}
              />
              <div className="grid grid-cols-2 gap-4">
                <TextField
                  type="time"
                  label={t("departsAt")}
                  required
                  value={values.departsAt}
                  error={errorOf("departsAt")}
                  onChange={(event) => update("departsAt", event.target.value)}
                />
                <TextField
                  type="time"
                  label={t("returnsAt")}
                  optionalText={tAll("common.optional")}
                  value={values.returnsAt}
                  error={errorOf("returnsAt")}
                  onChange={(event) => update("returnsAt", event.target.value)}
                />
              </div>
              <TextField
                label={t("pickup")}
                hint={t("pickupHint")}
                required
                maxLength={EVENT_PLACE_MAX_LENGTH}
                value={values.pickup}
                error={errorOf("pickup")}
                onChange={(event) => update("pickup", event.target.value)}
              />
              <TextField
                label={t("destination")}
                required
                maxLength={EVENT_PLACE_MAX_LENGTH}
                value={values.destination}
                error={errorOf("destination")}
                onChange={(event) => update("destination", event.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <TextField
                label={t("students")}
                required
                inputMode="numeric"
                dir="ltr"
                value={values.students}
                error={errorOf("students")}
                onChange={(event) => update("students", event.target.value)}
              />
              <SelectField
                label={t("busType")}
                required
                value={values.busType}
                options={BUS_TYPES.map((type) => ({
                  value: type,
                  label: tAll("desk.events.typeSeats", {
                    type: tAll(`student.busType.${type}`),
                    seats: formatNumber(EVENT_SEATS_BY_BUS[type], locale),
                  }),
                }))}
                onChange={(event) => update("busType", event.target.value as BusType)}
              />
              <TextField
                label={t("buses")}
                hint={
                  suggested
                    ? t("busesSuggested", { count: formatNumber(suggested, locale) })
                    : undefined
                }
                required
                inputMode="numeric"
                dir="ltr"
                value={values.buses}
                error={errorOf("buses")}
                onChange={(event) => update("buses", event.target.value)}
              />
            </div>
            {suggested && !values.buses ? (
              <div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => update("buses", String(suggested))}
                >
                  {t("useSuggested", { count: formatNumber(suggested, locale) })}
                </Button>
              </div>
            ) : null}
            <TextAreaField
              label={t("note")}
              hint={t("noteHint")}
              optionalText={tAll("common.optional")}
              rows={3}
              maxLength={EVENT_NOTE_MAX_LENGTH}
              value={values.note}
              onChange={(event) => update("note", event.target.value)}
            />
            {serverError ? <Alert tone={Tone.Danger} title={tErrors(serverError)} /> : null}
            <div>
              <Button type="submit" iconStart={<Send />} isLoading={isSending}>
                {t("send")}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
