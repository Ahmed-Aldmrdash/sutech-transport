"use client";

import { Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TextField } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { Tone } from "@/components/ui/tone";
import { PAYER_NAME_MAX_LENGTH, REFERENCE_MAX_LENGTH } from "@/features/payments/schema";
import type { Locale } from "@/i18n/routing";
import { focusFirstError } from "@/lib/forms/focus-first-error";
import { PIASTERS_PER_POUND, formatDateTime, formatMoney, todayInCairo } from "@/lib/format";
import { useSubmit } from "@/lib/hooks/use-submit";
import { findAwaitingPayment, recordOfficePayment } from "../api";
import { FinanceErrorCode, type AwaitingPayment } from "../schema";

const ERRORS = Object.values(FinanceErrorCode);
const FORM_ID = "visa-payment-form";
const MIN_TEXT = 3;

type FieldKey = "reference" | "amount" | "payer";

/**
 * A Visa payment taken at the Accounting office (A045): find the student's booking by their
 * university ID, then record the card machine's slip. The seat becomes active at once.
 */
export function VisaDialog({
  onClose,
  onRecorded,
}: {
  onClose: () => void;
  onRecorded: () => void;
}) {
  const t = useTranslations("desk.payments.visa");
  const tErrors = useTranslations("desk.payments.errors");
  const locale = useLocale() as Locale;
  const toast = useToast();
  const [identifier, setIdentifier] = useState("");
  const [booking, setBooking] = useState<AwaitingPayment | null>(null);
  const [reference, setReference] = useState("");
  const [amount, setAmount] = useState("");
  const [payer, setPayer] = useState("");
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const finder = useSubmit(ERRORS);
  const recorder = useSubmit(ERRORS);

  async function find(event: FormEvent) {
    event.preventDefault();
    if (!identifier.trim()) return;
    const found = await finder.submit(() => findAwaitingPayment(identifier.trim()));
    if (!found) return;
    setBooking(found);
    setAmount(String(found.price_piasters / PIASTERS_PER_POUND));
    setPayer(found.student.name);
  }

  async function record(event: FormEvent) {
    event.preventDefault();
    if (!booking) return;
    const pounds = Number(amount.replace(/[,\s]/g, ""));
    const next: Partial<Record<FieldKey, string>> = {};
    if (reference.trim().length < MIN_TEXT) next.reference = t("referenceRequired");
    if (!Number.isFinite(pounds) || pounds <= 0) next.amount = t("amountRequired");
    if (payer.trim().length < MIN_TEXT) next.payer = t("payerRequired");
    setErrors(next);
    if (Object.keys(next).length > 0) {
      focusFirstError(formRef.current);
      return;
    }
    const done = await recorder.submit((idempotencyKey) =>
      recordOfficePayment(
        {
          subscription_id: booking.subscription_id,
          reference_number: reference.trim(),
          amount_piasters: Math.round(pounds * PIASTERS_PER_POUND),
          paid_on: todayInCairo(),
          payer_name: payer.trim(),
        },
        { idempotencyKey },
      ),
    );
    if (!done) return;
    toast.show({ title: t("recorded", { name: booking.student.name }), tone: Tone.Success });
    onRecorded();
  }

  const serverError = booking ? recorder.serverError : finder.serverError;

  return (
    <Dialog
      open
      onClose={onClose}
      title={t("title")}
      description={t("lead")}
      footer={
        booking ? (
          <>
            <Button variant="secondary" onClick={() => setBooking(null)}>
              {t("back")}
            </Button>
            <Button type="submit" form={FORM_ID} isLoading={recorder.isSending}>
              {t("record")}
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={onClose}>
            {t("cancel")}
          </Button>
        )
      }
    >
      {booking ? (
        <form
          id={FORM_ID}
          ref={formRef}
          noValidate
          onSubmit={(event) => void record(event)}
          className="flex flex-col gap-4"
        >
          <div className="rounded-md bg-surface-alt p-3 text-body-sm text-ink">
            <p className="font-bold text-ink-strong">
              {booking.student.name} · <bdi>{booking.student.identifier}</bdi>
            </p>
            <p>
              {t("seat", {
                code: booking.line.code,
                line: booking.line.name,
                stop: booking.stop_name,
              })}
            </p>
            <p>{t("price", { amount: formatMoney(booking.price_piasters, locale) })}</p>
            {booking.hold_expires_at ? (
              <p className="text-caption text-ink-muted">
                {t("holdUntil", { time: formatDateTime(booking.hold_expires_at, locale) })}
              </p>
            ) : null}
          </div>
          <TextField
            label={t("reference")}
            hint={t("referenceHint")}
            required
            dir="ltr"
            maxLength={REFERENCE_MAX_LENGTH}
            value={reference}
            error={errors.reference}
            onChange={(event) => setReference(event.target.value)}
            autoComplete="off"
          />
          <TextField
            label={t("amount")}
            required
            inputMode="decimal"
            dir="ltr"
            value={amount}
            error={errors.amount}
            onChange={(event) => setAmount(event.target.value)}
          />
          <TextField
            label={t("payer")}
            hint={t("payerHint")}
            required
            maxLength={PAYER_NAME_MAX_LENGTH}
            value={payer}
            error={errors.payer}
            onChange={(event) => setPayer(event.target.value)}
          />
          {serverError ? <Alert tone={Tone.Danger} title={tErrors(serverError)} /> : null}
        </form>
      ) : (
        <form noValidate onSubmit={(event) => void find(event)} className="flex flex-col gap-4">
          <TextField
            label={t("identifier")}
            hint={t("identifierHint")}
            required
            inputMode="numeric"
            dir="ltr"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            autoComplete="off"
          />
          <Button
            type="submit"
            variant="secondary"
            iconStart={<Search />}
            isLoading={finder.isSending}
          >
            {t("find")}
          </Button>
          {serverError ? <Alert tone={Tone.Danger} title={tErrors(serverError)} /> : null}
        </form>
      )}
    </Dialog>
  );
}
