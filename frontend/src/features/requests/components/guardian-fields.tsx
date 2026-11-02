"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";
import { Checkbox } from "@/components/ui/choice";
import { TextField } from "@/components/ui/input";

/** Guardian's name, phone and approval: both university forms ask for them. */
export function GuardianFields({
  name,
  phone,
  consent,
  consentLabel,
  errors,
  onName,
  onPhone,
  onConsent,
}: {
  name: string;
  phone: string;
  consent: boolean;
  consentLabel: string;
  errors: { name?: string; phone?: string; consent?: string };
  onName: (value: string) => void;
  onPhone: (value: string) => void;
  onConsent: (value: boolean) => void;
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
        {t("guardian.title")}
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
      <div className="flex flex-col gap-1">
        <Checkbox
          label={consentLabel}
          description={t("guardian.consentHint")}
          checked={consent}
          aria-invalid={errors.consent ? true : undefined}
          onChange={(event) => onConsent(event.target.checked)}
        />
        {errors.consent ? (
          <p role="alert" className="text-body-sm text-danger">
            {errors.consent}
          </p>
        ) : null}
      </div>
    </div>
  );
}
