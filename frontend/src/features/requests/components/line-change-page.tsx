"use client";

import { Route } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { BackLink } from "@/components/ui/back-link";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Radio } from "@/components/ui/choice";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { SelectField, TextAreaField, TextField } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Tone } from "@/components/ui/tone";
import { useToast } from "@/components/ui/toast";
import { SessionStatus } from "@/features/auth/session/session-store";
import { useSession } from "@/features/auth/session/use-session";
import { userText } from "@/features/auth/user-text";
import { getLine, listLines } from "@/features/lines/api";
import type { Line } from "@/features/lines/schema";
import { getMySubscription } from "@/features/subscriptions/api";
import { SubscriptionStatus, type Subscription } from "@/features/subscriptions/schema";
import { useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { todayInCairo } from "@/lib/format";
import { AsyncStatus, useAsync } from "@/lib/hooks/use-async";
import { createLineChange } from "../api";
import {
  normalizePhone,
  validateLineChange,
  type FieldErrors,
  type LineChangeField,
  type LineChangeValues,
} from "../request-validation";
import { LineChangeDuration } from "../schema";
import { REQUEST_SERVER_ERRORS } from "./form-helpers";
import { GuardianFields } from "./guardian-fields";
import { REQUESTS_PATH } from "./requests-page";
import { useSubmit } from "@/lib/hooks/use-submit";
import { focusFirstError } from "@/lib/forms/focus-first-error";

/** The university's line change form ("طلب تغيير خط السير"), online. */
export function LineChangePage() {
  const t = useTranslations("student.requests");
  const data = useAsync(async (signal) => {
    const [mine, lines] = await Promise.all([getMySubscription({ signal }), listLines({ signal })]);
    return { subscription: mine.subscription, lines };
  }, []);

  const header = (
    <>
      <BackLink href={REQUESTS_PATH}>{t("title")}</BackLink>
      <PageHeader title={t("lineChange.title")} description={t("lineChange.lead")} />
    </>
  );

  if (data.status === AsyncStatus.Loading) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <Skeleton className="h-[32rem] w-full" />
      </div>
    );
  }
  if (data.status === AsyncStatus.Error) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <ErrorState error={data.error} onRetry={data.reload} />
      </div>
    );
  }
  const { subscription, lines } = data.data;
  return (
    <div className="flex flex-col gap-6">
      {header}
      {subscription?.status === SubscriptionStatus.Active ? (
        <LineChangeForm subscription={subscription} lines={lines} />
      ) : (
        <EmptyState
          icon={<Route />}
          title={t("needsActiveTitle")}
          description={t("needsActiveBody")}
          action={<ButtonLink href="/student">{t("goHome")}</ButtonLink>}
        />
      )}
    </div>
  );
}

function LineChangeForm({ subscription, lines }: { subscription: Subscription; lines: Line[] }) {
  const t = useTranslations("student");
  const tForm = useTranslations("student.requests");
  const router = useRouter();
  const toast = useToast();
  const session = useSession();
  const locale = useLocale() as Locale;
  const guardianName =
    session.status === SessionStatus.SignedIn
      ? (userText(session.session.user, locale).guardianName ?? "")
      : "";
  const today = todayInCairo();

  const [values, setValues] = useState<LineChangeValues>({
    toLineId: "",
    toStopId: "",
    duration: LineChangeDuration.Permanent,
    startsOn: today,
    endsOn: "",
    reason: "",
    studentPhone: "",
    guardianName,
    guardianPhone: "",
  });
  const [errors, setErrors] = useState<FieldErrors<LineChangeField>>({});
  const { submit, isSending, serverError } = useSubmit(REQUEST_SERVER_ERRORS);

  // The stops of the chosen line, loaded when the line changes.
  const stops = useAsync(
    (signal) => (values.toLineId ? getLine(values.toLineId, { signal }) : Promise.resolve(null)),
    [values.toLineId],
  );

  const update = <K extends LineChangeField>(key: K, value: LineChangeValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };
  const fieldError = (key: LineChangeField) => {
    const error = errors[key];
    return error ? tForm(`errors.${error}`) : undefined;
  };

  const lineOptions = lines
    .filter((line) => line.line_id !== subscription.line.line_id)
    .map((line) => ({
      value: line.line_id,
      label: tForm("lineChange.lineOption", {
        line: `${t("lineCode", { code: line.code })} · ${line.name}`,
        seats: line.seats_available,
      }),
    }));
  const stopOptions =
    stops.status === AsyncStatus.Success && stops.data
      ? stops.data.stops.map((stop) => ({ value: stop.stop_id, label: stop.name }))
      : [];

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const form = event.currentTarget as HTMLElement;
    const found = validateLineChange(values, {
      today,
      termStartsOn: subscription.term.starts_on,
      termEndsOn: subscription.term.ends_on,
      currentLineId: subscription.line.line_id,
    });
    setErrors(found);
    focusFirstError(form);
    if (Object.keys(found).length > 0) return;
    const isTemporary = values.duration === LineChangeDuration.Temporary;
    const created = await submit((idempotencyKey) =>
      createLineChange(
        {
          to_line_id: values.toLineId,
          to_stop_id: values.toStopId,
          duration: values.duration,
          starts_on: values.startsOn,
          ends_on: isTemporary ? values.endsOn : null,
          reason: values.reason.trim(),
          student_phone: normalizePhone(values.studentPhone),
          guardian_name: values.guardianName.trim(),
          guardian_phone: normalizePhone(values.guardianPhone),
        },
        { idempotencyKey },
      ),
    );
    if (created) {
      toast.show({ title: tForm("sent"), description: tForm("sentBody"), tone: Tone.Success });
      router.replace(`${REQUESTS_PATH}/${created.request_id}`);
    }
  }

  return (
    <Card elevation="raised">
      <CardBody>
        <form noValidate onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-5">
          <Alert tone={Tone.Info} title={tForm("lineChange.currentLine")}>
            {`${t("lineCode", { code: subscription.line.code })} · ${subscription.line.name} · ${subscription.stop.name}`}
          </Alert>

          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label={tForm("lineChange.toLine")}
              hint={tForm("lineChange.toLineHint")}
              placeholder={tForm("lineChange.chooseLine")}
              options={lineOptions}
              required
              error={fieldError("toLineId")}
              value={values.toLineId}
              onChange={(event) => {
                update("toLineId", event.target.value);
                update("toStopId", "");
              }}
            />
            <SelectField
              label={tForm("lineChange.toStop")}
              hint={tForm("lineChange.toStopHint")}
              placeholder={
                stops.status === AsyncStatus.Loading && values.toLineId
                  ? tForm("lineChange.loadingStops")
                  : tForm("lineChange.chooseStop")
              }
              options={stopOptions}
              required
              disabled={!values.toLineId || stopOptions.length === 0}
              error={fieldError("toStopId")}
              value={values.toStopId}
              onChange={(event) => update("toStopId", event.target.value)}
            />
          </div>

          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-body-sm font-bold text-ink-strong">
              {tForm("lineChange.duration")}
            </legend>
            <div className="flex flex-wrap gap-x-6">
              {[LineChangeDuration.Permanent, LineChangeDuration.Temporary].map((duration) => (
                <Radio
                  key={duration}
                  name="duration"
                  value={duration}
                  label={tForm(`lineChange.${duration}`)}
                  description={tForm(`lineChange.${duration}Hint`)}
                  checked={values.duration === duration}
                  onChange={() => update("duration", duration)}
                />
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              type="date"
              label={tForm("lineChange.startsOn")}
              required
              min={today}
              max={subscription.term.ends_on}
              error={fieldError("startsOn")}
              value={values.startsOn}
              onChange={(event) => update("startsOn", event.target.value)}
            />
            {values.duration === LineChangeDuration.Temporary ? (
              <TextField
                type="date"
                label={tForm("lineChange.endsOn")}
                required
                min={values.startsOn || today}
                max={subscription.term.ends_on}
                error={fieldError("endsOn")}
                value={values.endsOn}
                onChange={(event) => update("endsOn", event.target.value)}
              />
            ) : null}
          </div>

          <TextAreaField
            label={tForm("lineChange.reason")}
            hint={tForm("textHint")}
            required
            error={fieldError("reason")}
            value={values.reason}
            onChange={(event) => update("reason", event.target.value)}
          />

          <TextField
            label={tForm("lineChange.studentPhone")}
            hint={tForm("phoneHint")}
            required
            type="tel"
            dir="ltr"
            inputMode="tel"
            autoComplete="tel"
            containerClassName="sm:max-w-sm"
            error={fieldError("studentPhone")}
            value={values.studentPhone}
            onChange={(event) => update("studentPhone", event.target.value)}
          />

          <GuardianFields
            title={tForm("guardian.lineChangeTitle")}
            name={values.guardianName}
            phone={values.guardianPhone}
            note={tForm("guardian.lineChangeNote")}
            errors={{ name: fieldError("guardianName"), phone: fieldError("guardianPhone") }}
            onName={(value) => update("guardianName", value)}
            onPhone={(value) => update("guardianPhone", value)}
          />

          {serverError ? (
            <Alert tone={Tone.Danger} title={tForm(`serverErrors.${serverError}`)} />
          ) : null}
          <Button type="submit" withArrow isLoading={isSending} className="self-start">
            {tForm("lineChange.submit")}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
