"use client";

import { useLocale, useTranslations } from "next-intl";
import { Radio } from "@/components/ui/choice";
import type { Locale } from "@/i18n/routing";
import { formatMoney } from "@/lib/format";
import { refundAmount } from "../refund-policy";
import { EXCEPTIONAL_REFUND_REASONS, REFUND_REASONS, RefundReason } from "../schema";

/** Why the student is leaving. The standard refund closes once its window has passed. */
export function ReasonChoice({
  value,
  windowOpen,
  error,
  onChange,
}: {
  value: RefundReason | "";
  windowOpen: boolean;
  error: string | undefined;
  onChange: (reason: RefundReason) => void;
}) {
  const t = useTranslations("student.requests");
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-body-sm font-bold text-ink-strong">{t("refund.reason")}</legend>
      {REFUND_REASONS.map((reason) => {
        const isClosed = reason === RefundReason.Standard && !windowOpen;
        return (
          <Radio
            key={reason}
            name="reason"
            value={reason}
            disabled={isClosed}
            label={t(`refund.reasons.${reason}.label`)}
            description={isClosed ? t("refund.standardClosed") : t(`refund.reasons.${reason}.hint`)}
            checked={value === reason}
            onChange={() => onChange(reason)}
          />
        );
      })}
      {error ? (
        <p role="alert" className="text-body-sm text-danger-text">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

/** What was paid, the deduction and what comes back (the university decides the exceptions). */
export function RefundEstimate({
  paid,
  deductionPercent,
  reason,
}: {
  paid: number;
  deductionPercent: number;
  reason: RefundReason | "";
}) {
  const t = useTranslations("student.requests");
  const locale = useLocale() as Locale;
  const isExceptional = reason !== "" && EXCEPTIONAL_REFUND_REASONS.includes(reason);
  return (
    <dl className="grid grid-cols-1 gap-3 rounded-md bg-brand-soft p-4 sm:grid-cols-3">
      <div>
        <dt className="text-caption text-brand">{t("refund.paid")}</dt>
        <dd className="text-body font-bold text-ink-strong">{formatMoney(paid, locale)}</dd>
      </div>
      <div>
        <dt className="text-caption text-brand">{t("refund.deduction")}</dt>
        <dd className="text-body font-bold text-ink-strong">
          {isExceptional
            ? t("refund.decidedByUniversity")
            : t("refund.percent", { percent: deductionPercent })}
        </dd>
      </div>
      <div>
        <dt className="text-caption text-brand">{t("refund.estimate")}</dt>
        <dd className="text-body font-bold text-ink-strong">
          {isExceptional || reason === ""
            ? t("refund.decidedByUniversity")
            : formatMoney(refundAmount(paid, deductionPercent), locale)}
        </dd>
      </div>
    </dl>
  );
}
