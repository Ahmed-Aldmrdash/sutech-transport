"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Radio } from "@/components/ui/choice";
import { ConfirmDialog } from "@/components/ui/dialog";
import { TextField } from "@/components/ui/input";
import { Tone } from "@/components/ui/tone";
import { CHECKOUT_REASONS, CREW_NOTE_MAX_LENGTH, type CheckoutReason } from "../schema";

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
export function CheckoutDialog(props: CheckoutDialogProps) {
  // A fresh form each time it opens: no reason left over from the last student.
  return <CheckoutForm key={props.open ? "open" : "closed"} {...props} />;
}

function CheckoutForm({
  open,
  riderName,
  isSending,
  error,
  onClose,
  onConfirm,
}: CheckoutDialogProps) {
  const t = useTranslations("crew.checkout");
  const tCommon = useTranslations("common");
  // Nothing is picked for the crew: a hurried tap must not record "unwell" when it wasn't.
  const [reason, setReason] = useState<CheckoutReason | null>(null);
  const [note, setNote] = useState("");
  const [missingReason, setMissingReason] = useState(false);

  function confirm() {
    if (!reason) {
      setMissingReason(true);
      return;
    }
    onConfirm(reason, note.trim() || null);
  }

  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={confirm}
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
              onChange={() => {
                setReason(value);
                setMissingReason(false);
              }}
            />
          ))}
          {missingReason ? (
            <p role="alert" className="mt-1 text-body-sm font-bold text-danger-text">
              {t("reasonRequired")}
            </p>
          ) : null}
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
