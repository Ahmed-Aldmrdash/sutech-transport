"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";
import { Checkbox } from "@/components/ui/choice";
import { TextField } from "@/components/ui/input";

/**
 * Guardian's name and phone, which both university forms ask for. A refund also takes the
 * student's word that the guardian agrees (`consent`); a line change instead goes to the
 * guardian in the app, so it shows `note` and no checkbox.
 */
export function GuardianFields({
  title,
  name,
  phone,
  consent,
  note,
  errors,
  onName,
  onPhone,
}: {
  title?: string;
  name: string;
  phone: string;
  consent?: {
    checked: boolean;
    label: string;
    error?: string;
    onChange: (value: boolean) => void;
  };
  note?: string;
  errors: { name?: string; phone?: string };
  onName: (value: string) => void;
  onPhone: (value: string) => void;
}) {
  const t = useTranslations("student.requests");
  const titleId = useId();
  return (
    <div
      role="group"
      aria-labelledby={titleId}
      className="flex flex-col gap-4 rounded-md bg-surface-alt p-4"
    >
      <p id={titleId} className="text-body-sm font-bold text-ink-strong">
        {title ?? t("guardian.title")}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={t("guardian.name")}
          required
          autoComplete="off"
          error={errors.name}
          value={name}
          onChange={(event) => onName(event.target.value)}
        />
        <TextField
          label={t("guardian.phone")}
          hint={t("phoneHint")}
          required
          type="tel"
          dir="ltr"
          inputMode="tel"
          error={errors.phone}
          value={phone}
          onChange={(event) => onPhone(event.target.value)}
        />
      </div>
      {consent ? (
        <div className="flex flex-col gap-1">
          <Checkbox
            label={consent.label}
            description={t("guardian.consentHint")}
            checked={consent.checked}
            aria-invalid={consent.error ? true : undefined}
            onChange={(event) => consent.onChange(event.target.checked)}
          />
          {consent.error ? (
            <p role="alert" className="text-body-sm text-danger">
              {consent.error}
            </p>
          ) : null}
        </div>
      ) : null}
      {note ? <p className="text-body-sm text-ink">{note}</p> : null}
    </div>
  );
}
