"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Radio } from "@/components/ui/choice";
import { ConfirmDialog } from "@/components/ui/dialog";
import { TextField } from "@/components/ui/input";
import { Tone } from "@/components/ui/tone";
import { CHECKOUT_REASONS, CREW_NOTE_MAX_LENGTH, CheckoutReason } from "../schema";

interface CheckoutDialogProps {
  open: boolean;
  /** Who is leaving, when known before the scan is sent (from the passenger list). */
  riderName: string | null;
  isSending: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (reason: CheckoutReason, note: string | null) => void;
}

/** A student leaving the bus mid-trip: the reason is required; the guardian is told at once. */
export function CheckoutDialog({
  open,
  riderName,
  isSending,
  error,
  onClose,
  onConfirm,
}: CheckoutDialogProps) {
  const t = useTranslations("crew.checkout");
  const tCommon = useTranslations("common");
  const [reason, setReason] = useState<CheckoutReason>(CheckoutReason.Unwell);
  const [note, setNote] = useState("");

  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={() => onConfirm(reason, note.trim() || null)}
      isConfirming={isSending}
      title={riderName ? t("titleNamed", { name: riderName }) : t("title")}
      description={t("body")}
      confirmLabel={t("confirm")}
    >
      <div className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-body-sm font-bold text-ink-strong">{t("reason")}</legend>
          {CHECKOUT_REASONS.map((value) => (
            <Radio
              key={value}
              name="checkout-reason"
              value={value}
              label={t(`reasons.${value}`)}
              checked={reason === value}
              onChange={() => setReason(value)}
            />
          ))}
        </fieldset>
        <TextField
          label={t("note")}
          optionalText={tCommon("optional")}
          maxLength={CREW_NOTE_MAX_LENGTH}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
        {error ? <Alert tone={Tone.Danger} title={error} /> : null}
      </div>
    </ConfirmDialog>
  );
}
