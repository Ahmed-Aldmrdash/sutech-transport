"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Radio } from "@/components/ui/choice";
import { TextField } from "@/components/ui/input";
import { Tone } from "@/components/ui/tone";
import { useToast } from "@/components/ui/toast";
import type { Subscription } from "@/features/subscriptions/schema";
import type { Locale } from "@/i18n/routing";
import { focusFirstError } from "@/lib/forms/focus-first-error";
import { useFormDraft } from "@/lib/forms/form-draft";
import {
  PIASTERS_PER_POUND,
  formatCalendarDate,
  formatFileSize,
  formatMoney,
  todayInCairo,
} from "@/lib/format";
import {
  maximumPiastersFor,
  type ReceiptErrors,
  type ReceiptFormValues,
} from "../receipt-validation";
import { RECEIPT_METHODS, type PaymentInstructions } from "../schema";
import { ReceiptFileField } from "./receipt-file-field";
import { useSendReceipt } from "./use-send-receipt";

interface ReceiptFormProps {
  subscription: Subscription;
  instructions: PaymentInstructions;
  onSent: () => void;
}

/** Uploads a bank deposit or transfer receipt for the held seat. */
export function ReceiptForm({ subscription, instructions, onSent }: ReceiptFormProps) {
  const t = useTranslations("student.payment.receipt");
  const locale = useLocale() as Locale;
  const toast = useToast();
  // A draft: switching language halfway keeps what was typed (and the chosen photo).
  const [values, setValues, clearDraft] = useFormDraft<ReceiptFormValues>(
    `receipt-${subscription.subscription_id}`,
    {
      method: RECEIPT_METHODS[0],
      reference: "",
      amount: String(subscription.price_piasters / PIASTERS_PER_POUND),
      paidOn: "",
      payer: "",
      file: null,
    },
  );
  const [errors, setErrors] = useState<ReceiptErrors>({});
  const today = todayInCairo();
  const update = <K extends keyof ReceiptFormValues>(key: K, value: ReceiptFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };
  const fieldError = (key: keyof ReceiptErrors) => {
    const error = errors[key];
    if (!error) return undefined;
    return t(error, {
      amount: formatMoney(subscription.price_piasters, locale),
      maximum: formatMoney(maximumPiastersFor(subscription.price_piasters), locale),
      date: formatCalendarDate(todayInCairo(new Date(subscription.reserved_at)), locale),
      size: formatFileSize(instructions.receipt_max_bytes, locale),
    });
  };

  const { send, isSending, serverError } = useSendReceipt({
    subscription,
    instructions,
    today,
    onInvalid: setErrors,
    onSent: () => {
      clearDraft();
      toast.show({ title: t("sent"), description: t("sentBody"), tone: Tone.Success });
      onSent();
    },
  });

  return (
    <Card elevation="raised">
      <CardHeader title={t("title")} description={t("lead")} />
      <CardBody>
        <form
          noValidate
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            void send(values);
            focusFirstError(event.currentTarget as HTMLElement);
          }}
          className="flex flex-col gap-4"
        >
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-body-sm font-bold text-ink-strong">{t("method")}</legend>
            <div className="flex flex-wrap gap-x-6">
              {RECEIPT_METHODS.map((method) => (
                <Radio
                  key={method}
                  name="method"
                  value={method}
                  label={t(method)}
                  checked={values.method === method}
                  onChange={() => update("method", method)}
                />
              ))}
            </div>
          </fieldset>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label={t("reference")}
              hint={t("referenceHint")}
              error={fieldError("reference")}
              required
              dir="ltr"
              autoComplete="off"
              value={values.reference}
              onChange={(event) => update("reference", event.target.value)}
            />
            <TextField
              label={t("amount")}
              error={fieldError("amount")}
              required
              dir="ltr"
              inputMode="decimal"
              value={values.amount}
              onChange={(event) => update("amount", event.target.value)}
            />
            <TextField
              label={t("paidOn")}
              error={fieldError("paidOn")}
              required
              type="date"
              min={todayInCairo(new Date(subscription.reserved_at))}
              max={today}
              value={values.paidOn}
              onChange={(event) => update("paidOn", event.target.value)}
            />
            <TextField
              label={t("payer")}
              hint={t("payerHint")}
              error={fieldError("payer")}
              required
              autoComplete="name"
              value={values.payer}
              onChange={(event) => update("payer", event.target.value)}
            />
          </div>
          <ReceiptFileField
            file={values.file}
            maxBytes={instructions.receipt_max_bytes}
            error={fieldError("file")}
            onChange={(file) => update("file", file)}
          />
          {serverError ? <Alert tone={Tone.Danger} title={t(`errors.${serverError}`)} /> : null}
          <Button type="submit" withArrow isLoading={isSending} className="self-start">
            {t("submit")}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
