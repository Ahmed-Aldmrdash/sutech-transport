"use client";

import { useRequestForm } from "./use-request-form";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { TextAreaField, TextField } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { Tone } from "@/components/ui/tone";
import { useToast } from "@/components/ui/toast";
import type { Line } from "@/features/lines/schema";
import { RECEIPT_MAX_BYTES } from "@/features/payments/schema";
import { SubscriptionStatus, type Subscription } from "@/features/subscriptions/schema";
import { useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatFileSize, todayInCairo } from "@/lib/format";
import { createComplaint } from "../api";
import { validateComplaint, type ComplaintValues } from "../request-validation";
import { COMPLAINT_CATEGORIES, ComplaintCategory } from "../schema";
import { AttachmentsField } from "./attachments-field";
import { REQUEST_SERVER_ERRORS, toUploads } from "./form-helpers";
import { COMPLAINTS_PATH } from "./requests-page";
import { useSubmit } from "@/lib/hooks/use-submit";
import { focusFirstError } from "@/lib/forms/focus-first-error";

export function ComplaintForm({
  subscription,
  lines,
}: {
  subscription: Subscription;
  lines: readonly Line[];
}) {
  const t = useTranslations("student");
  const tForm = useTranslations("student.requests");
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const toast = useToast();
  const today = todayInCairo();
  // Before the subscription is active, only payment complaints are accepted.
  const isActive = subscription.status === SubscriptionStatus.Active;
  const categories = isActive ? COMPLAINT_CATEGORIES : [ComplaintCategory.Payment];
  const { values, setErrors, update, fieldError, clearDraft } = useRequestForm<ComplaintValues>(
    "complaint",
    {
      category: isActive ? "" : ComplaintCategory.Payment,
      lineId: subscription.line.line_id,
      happenedOn: today,
      description: "",
      attachments: [],
    },
  );
  const { submit, isSending, serverError } = useSubmit(REQUEST_SERVER_ERRORS);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const form = event.currentTarget as HTMLElement;
    const found = validateComplaint(values, {
      today,
      termStartsOn: subscription.term.starts_on,
      termEndsOn: subscription.term.ends_on,
      maxBytes: RECEIPT_MAX_BYTES,
    });
    setErrors(found);
    focusFirstError(form);
    if (Object.keys(found).length > 0 || values.category === "") return;
    const { category } = values;
    const created = await submit(async (idempotencyKey) =>
      createComplaint(
        {
          category,
          line_id: values.lineId || null,
          happened_on: values.happenedOn,
          description: values.description.trim(),
          attachments: await toUploads(values.attachments),
        },
        { idempotencyKey },
      ),
    );
    if (created) {
      clearDraft();
      toast.show({ title: tForm("sent"), description: tForm("sentBody"), tone: Tone.Success });
      router.replace(`${COMPLAINTS_PATH}/${created.request_id}`);
    }
  }

  return (
    <Card elevation="raised">
      <CardBody>
        <form noValidate onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-5">
          {!isActive ? <Alert tone={Tone.Info} title={tForm("complaint.onlyPayment")} /> : null}
          {values.category === ComplaintCategory.Safety ? (
            <Alert tone={Tone.Danger} title={tForm("complaint.safetyTitle")}>
              {tForm("complaint.safetyBody")}
            </Alert>
          ) : null}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField
              label={tForm("complaint.category")}
              placeholder={tForm("complaint.chooseCategory")}
              required
              options={categories.map((category) => ({
                value: category,
                label: tForm(`complaint.categories.${category}`),
              }))}
              error={fieldError("category")}
              value={values.category}
              onChange={(event) =>
                update("category", event.target.value as ComplaintValues["category"])
              }
            />
            <SelectField
              label={tForm("complaint.line")}
              optionalText={tCommon("optional")}
              placeholder={tForm("complaint.noLine")}
              options={lines.map((line) => ({
                value: line.line_id,
                label: `${t("lineCode", { code: line.code })} · ${line.name}`,
              }))}
              value={values.lineId}
              onChange={(event) => update("lineId", event.target.value)}
            />
            <TextField
              type="date"
              label={tForm("complaint.happenedOn")}
              required
              max={today}
              error={fieldError("happenedOn")}
              value={values.happenedOn}
              onChange={(event) => update("happenedOn", event.target.value)}
            />
          </div>
          <TextAreaField
            label={tForm("complaint.description")}
            hint={tForm("complaint.descriptionHint")}
            required
            rows={5}
            error={fieldError("description")}
            value={values.description}
            onChange={(event) => update("description", event.target.value)}
          />
          <AttachmentsField
            maxBytes={RECEIPT_MAX_BYTES}
            label={tForm("complaint.attachments")}
            hint={tForm("complaint.attachmentsHint", {
              size: formatFileSize(RECEIPT_MAX_BYTES, locale),
            })}
            files={values.attachments}
            error={fieldError("attachments")}
            onChange={(files) => update("attachments", files)}
          />
          {serverError ? (
            <Alert
              tone={Tone.Danger}
              title={tForm(`serverErrors.${serverError}`, {
                size: formatFileSize(RECEIPT_MAX_BYTES, locale),
              })}
            />
          ) : null}
          <Button type="submit" withArrow isLoading={isSending} className="self-start">
            {tForm("complaint.submit")}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
