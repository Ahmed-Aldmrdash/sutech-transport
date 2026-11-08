"use client";

import { useLocale, useTranslations } from "next-intl";
import { type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { TextField } from "@/components/ui/input";
import { Tone } from "@/components/ui/tone";
import { useToast } from "@/components/ui/toast";
import { SessionStatus } from "@/features/auth/session/session-store";
import { useSession } from "@/features/auth/session/use-session";
import { userText } from "@/features/auth/user-text";
import { type Subscription } from "@/features/subscriptions/schema";
import { useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { todayInCairo } from "@/lib/format";
import { useSubmit } from "@/lib/hooks/use-submit";
import { createModelPermit } from "../api";
import { validateModelPermit, type ModelPermitValues } from "../request-validation";
import { REQUEST_SERVER_ERRORS } from "./form-helpers";
import { useRequestForm } from "./use-request-form";
import { emptyModelPermit, toModelPermitBody } from "./model-permit-values";
import { Declaration } from "./model-permit-declaration";
import { ModelFields, Section } from "./model-permit-fields";
import { TimesFields } from "./model-permit-times";
import { REQUESTS_PATH } from "./requests-page";
import { focusFirstError } from "@/lib/forms/focus-first-error";

export function ModelPermitForm({ subscription }: { subscription: Subscription }) {
  const t = useTranslations("student");
  const tForm = useTranslations("student.requests");
  const tPermit = useTranslations("student.requests.modelPermit");
  const router = useRouter();
  const toast = useToast();
  const session = useSession();
  const locale = useLocale() as Locale;
  const today = todayInCairo();
  const user = session.status === SessionStatus.SignedIn ? session.session.user : null;
  const student = user ? userText(user, locale) : null;

  const { values, setErrors, update, fieldError, clearDraft } = useRequestForm<ModelPermitValues>(
    "model-permit",
    () => emptyModelPermit(today),
  );
  const { submit, isSending, serverError } = useSubmit(REQUEST_SERVER_ERRORS);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const form = event.currentTarget as HTMLElement;
    const found = validateModelPermit(values, {
      today,
      termStartsOn: subscription.term.starts_on,
      termEndsOn: subscription.term.ends_on,
    });
    setErrors(found);
    focusFirstError(form);
    if (Object.keys(found).length > 0) return;
    const created = await submit((idempotencyKey) =>
      createModelPermit(toModelPermitBody(values), { idempotencyKey }),
    );
    if (created) {
      clearDraft();
      toast.show({ title: tForm("sent"), description: tForm("sentBody"), tone: Tone.Success });
      router.replace(`${REQUESTS_PATH}/${created.request_id}`);
    }
  }

  const studentLine = [
    student?.name,
    user?.identifier,
    student?.faculty,
    user?.level ? tPermit("levelValue", { level: user.level }) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card elevation="raised">
      <CardBody>
        <form noValidate onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <Alert tone={Tone.Info} title={tPermit("studentTitle")}>
              {studentLine}
            </Alert>
            <Alert tone={Tone.Info} title={tPermit("busTitle")}>
              {`${t("lineCode", { code: subscription.line.code })} · ${subscription.line.name}. ${tPermit("driverByOffice")}`}
            </Alert>
          </div>

          <ModelFields values={values} update={update} fieldError={fieldError} />

          <TimesFields
            values={values}
            update={update}
            fieldError={fieldError}
            today={today}
            lastDay={subscription.term.ends_on}
          />

          <Section title={tPermit("signaturesTitle")}>
            <TextField
              label={tPermit("supervisorName")}
              hint={tPermit("supervisorHint")}
              required
              autoComplete="off"
              containerClassName="sm:max-w-md"
              error={fieldError("supervisorName")}
              value={values.supervisorName}
              onChange={(event) => update("supervisorName", event.target.value)}
            />
          </Section>

          <Declaration
            values={values}
            update={update}
            fieldError={fieldError}
            name={student?.name ?? ""}
            identifier={user?.identifier ?? ""}
          />

          {serverError ? (
            <Alert tone={Tone.Danger} title={tForm(`serverErrors.${serverError}`)} />
          ) : null}
          <Button type="submit" withArrow isLoading={isSending} className="self-start">
            {tPermit("submit")}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
