"use client";

import { Package } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { BackLink } from "@/components/ui/back-link";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Checkbox, Radio } from "@/components/ui/choice";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { TextField } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Tone } from "@/components/ui/tone";
import { useToast } from "@/components/ui/toast";
import { SessionStatus } from "@/features/auth/session/session-store";
import { useSession } from "@/features/auth/session/use-session";
import { userText } from "@/features/auth/user-text";
import { getMySubscription } from "@/features/subscriptions/api";
import { SubscriptionStatus, type Subscription } from "@/features/subscriptions/schema";
import { useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { todayInCairo } from "@/lib/format";
import { AsyncStatus, useAsync } from "@/lib/hooks/use-async";
import { useSubmit } from "@/lib/hooks/use-submit";
import { createModelPermit } from "../api";
import {
  validateModelPermit,
  type FieldErrors,
  type ModelPermitField,
  type ModelPermitValues,
} from "../request-validation";
import { MODEL_PERMIT_PLEDGES, MODEL_PURPOSES, ModelPurpose } from "../schema";
import { REQUEST_SERVER_ERRORS } from "./form-helpers";
import { REQUESTS_PATH } from "./requests-page";

/**
 * The university's safety permit for bringing a project model onto the bus
 * ("تصريح دخول مجسم في باص الجامعة"), online. The student's details and the bus come from the
 * account and subscription; the student fills in the model, the times and who signs.
 */
export function ModelPermitPage() {
  const t = useTranslations("student.requests");
  const data = useAsync((signal) => getMySubscription({ signal }), []);

  const header = (
    <>
      <BackLink href={REQUESTS_PATH}>{t("title")}</BackLink>
      <PageHeader title={t("modelPermit.title")} description={t("modelPermit.lead")} />
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
  const { subscription } = data.data;
  return (
    <div className="flex flex-col gap-6">
      {header}
      {subscription?.status === SubscriptionStatus.Active ? (
        <ModelPermitForm subscription={subscription} />
      ) : (
        <EmptyState
          icon={<Package />}
          title={t("needsActiveTitle")}
          description={t("modelPermit.needsActiveBody")}
          action={<ButtonLink href="/student">{t("goHome")}</ButtonLink>}
        />
      )}
    </div>
  );
}

/** A titled box inside the form, like the sections of the paper permit. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  const titleId = useId();
  return (
    <div role="group" aria-labelledby={titleId} className="flex flex-col gap-4">
      <p id={titleId} className="text-body font-bold text-ink-strong">
        {title}
      </p>
      {children}
    </div>
  );
}

function ModelPermitForm({ subscription }: { subscription: Subscription }) {
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

  const [values, setValues] = useState<ModelPermitValues>({
    material: "",
    dimensions: "",
    purpose: "",
    purposeOther: "",
    destination: "",
    entryDate: today,
    entryTime: "",
    exitDate: today,
    exitTime: "",
    supervisorName: "",
    declarationAccepted: false,
  });
  const [errors, setErrors] = useState<FieldErrors<ModelPermitField>>({});
  const { submit, isSending, serverError } = useSubmit(REQUEST_SERVER_ERRORS);

  const update = <K extends ModelPermitField>(key: K, value: ModelPermitValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };
  const fieldError = (key: ModelPermitField) => {
    const error = errors[key];
    return error ? tForm(`errors.${error}`) : undefined;
  };

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validateModelPermit(values, {
      today,
      termStartsOn: subscription.term.starts_on,
      termEndsOn: subscription.term.ends_on,
    });
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const purpose = values.purpose as ModelPurpose;
    const created = await submit((idempotencyKey) =>
      createModelPermit(
        {
          material: values.material.trim(),
          dimensions: values.dimensions.trim(),
          purpose,
          purpose_other: purpose === ModelPurpose.Other ? values.purposeOther.trim() : null,
          destination: values.destination.trim(),
          entry_date: values.entryDate,
          entry_time: values.entryTime,
          exit_date: values.exitDate,
          exit_time: values.exitTime,
          supervisor_name: values.supervisorName.trim(),
          declaration_accepted: true,
        },
        { idempotencyKey },
      ),
    );
    if (created) {
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

          <Section title={tPermit("modelTitle")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label={tPermit("material")}
                hint={tPermit("materialHint")}
                required
                autoComplete="off"
                error={fieldError("material")}
                value={values.material}
                onChange={(event) => update("material", event.target.value)}
              />
              <TextField
                label={tPermit("dimensions")}
                hint={tPermit("dimensionsHint")}
                required
                autoComplete="off"
                error={fieldError("dimensions")}
                value={values.dimensions}
                onChange={(event) => update("dimensions", event.target.value)}
              />
            </div>
          </Section>

          <Section title={tPermit("purposeTitle")}>
            <fieldset className="flex flex-col gap-1">
              <legend className="mb-1 text-body-sm font-bold text-ink-strong">
                {tPermit("purpose")}
              </legend>
              <div className="flex flex-wrap gap-x-6">
                {MODEL_PURPOSES.map((purpose) => (
                  <Radio
                    key={purpose}
                    name="purpose"
                    value={purpose}
                    label={tPermit(`purposes.${purpose}`)}
                    checked={values.purpose === purpose}
                    aria-invalid={errors.purpose ? true : undefined}
                    onChange={() => update("purpose", purpose)}
                  />
                ))}
              </div>
              {errors.purpose ? (
                <p role="alert" className="text-body-sm text-danger">
                  {fieldError("purpose")}
                </p>
              ) : null}
            </fieldset>
            {values.purpose === ModelPurpose.Other ? (
              <TextField
                label={tPermit("purposeOther")}
                required
                autoComplete="off"
                containerClassName="sm:max-w-sm"
                error={fieldError("purposeOther")}
                value={values.purposeOther}
                onChange={(event) => update("purposeOther", event.target.value)}
              />
            ) : null}
            <TextField
              label={tPermit("destination")}
              hint={tPermit("destinationHint")}
              required
              autoComplete="off"
              error={fieldError("destination")}
              value={values.destination}
              onChange={(event) => update("destination", event.target.value)}
            />
          </Section>

          <Section title={tPermit("timesTitle")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                type="date"
                label={tPermit("entryDate")}
                required
                min={today}
                max={subscription.term.ends_on}
                error={fieldError("entryDate")}
                value={values.entryDate}
                onChange={(event) => update("entryDate", event.target.value)}
              />
              <TextField
                type="time"
                label={tPermit("entryTime")}
                required
                error={fieldError("entryTime")}
                value={values.entryTime}
                onChange={(event) => update("entryTime", event.target.value)}
              />
              <TextField
                type="date"
                label={tPermit("exitDate")}
                required
                min={values.entryDate || today}
                max={subscription.term.ends_on}
                error={fieldError("exitDate")}
                value={values.exitDate}
                onChange={(event) => update("exitDate", event.target.value)}
              />
              <TextField
                type="time"
                label={tPermit("exitTime")}
                required
                error={fieldError("exitTime")}
                value={values.exitTime}
                onChange={(event) => update("exitTime", event.target.value)}
              />
            </div>
          </Section>

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

          <div className="flex flex-col gap-3 rounded-md bg-surface-alt p-4">
            <p className="text-body-sm font-bold text-ink-strong">{tPermit("declarationTitle")}</p>
            <p className="text-body-sm text-ink">
              {tPermit("declarationIntro", {
                name: student?.name ?? "",
                id: user?.identifier ?? "",
              })}
            </p>
            <ul className="flex list-disc flex-col gap-1 ps-5 text-body-sm text-ink">
              {MODEL_PERMIT_PLEDGES.map((pledge) => (
                <li key={pledge}>{tPermit(`pledges.${pledge}`)}</li>
              ))}
            </ul>
            <p className="text-body-sm text-ink">{tPermit("declarationOutro")}</p>
            <div className="flex flex-col gap-1">
              <Checkbox
                label={tPermit("declarationAccept")}
                checked={values.declarationAccepted}
                aria-invalid={errors.declarationAccepted ? true : undefined}
                onChange={(event) => update("declarationAccepted", event.target.checked)}
              />
              {errors.declarationAccepted ? (
                <p role="alert" className="text-body-sm text-danger">
                  {fieldError("declarationAccepted")}
                </p>
              ) : null}
            </div>
          </div>

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
