"use client";

import { useLocale, useTranslations } from "next-intl";
import { type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { TextAreaField, TextField } from "@/components/ui/input";
import { Tone } from "@/components/ui/tone";
import { useToast } from "@/components/ui/toast";
import { SessionStatus } from "@/features/auth/session/session-store";
import { useSession } from "@/features/auth/session/use-session";
import { userText } from "@/features/auth/user-text";
import type { Line } from "@/features/lines/schema";
import { type Subscription } from "@/features/subscriptions/schema";
import { useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { todayInCairo } from "@/lib/format";
import { createLineChange } from "../api";
import { normalizePhone, validateLineChange, type LineChangeValues } from "../request-validation";
import { LineChangeDuration } from "../schema";
import { REQUEST_SERVER_ERRORS } from "./form-helpers";
import { useRequestForm } from "./use-request-form";
import { DestinationFields, WhenFields } from "./line-change-fields";
import { GuardianFields } from "./guardian-fields";
import { REQUESTS_PATH } from "./requests-page";
import { useSubmit } from "@/lib/hooks/use-submit";
import { focusFirstError } from "@/lib/forms/focus-first-error";

export function LineChangeForm({
  subscription,
  lines,
}: {
  subscription: Subscription;
  lines: Line[];
}) {
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

  const { values, setErrors, update, fieldError, clearDraft } = useRequestForm<LineChangeValues>(
    "line-change",
    {
      toLineId: "",
      toStopId: "",
      duration: LineChangeDuration.Permanent,
      startsOn: today,
      endsOn: "",
      reason: "",
      // The student's own registered mobile, already known to the app.
      studentPhone:
        session.status === SessionStatus.SignedIn ? (session.session.user.phone ?? "") : "",
      guardianName,
      guardianPhone: "",
    },
  );
  const { submit, isSending, serverError } = useSubmit(REQUEST_SERVER_ERRORS);

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
      clearDraft();
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

          <DestinationFields
            lines={lines}
            currentLineId={subscription.line.line_id}
            values={values}
            update={update}
            fieldError={fieldError}
          />

          <WhenFields
            values={values}
            update={update}
            fieldError={fieldError}
            today={today}
            lastDay={subscription.term.ends_on}
          />

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
