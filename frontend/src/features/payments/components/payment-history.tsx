"use client";

import { Receipt } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Tone } from "@/components/ui/tone";
import type { Locale } from "@/i18n/routing";
import { formatDate, formatMoney } from "@/lib/format";
import { PaymentStatus, type Payment } from "../schema";

const STATUS_TONE: Record<PaymentStatus, Tone> = {
  [PaymentStatus.PendingReview]: Tone.Info,
  [PaymentStatus.Approved]: Tone.Success,
  [PaymentStatus.Rejected]: Tone.Danger,
};

/** Every receipt the student sent this term, newest first, with its review result. */
export function PaymentHistory({ payments }: { payments: readonly Payment[] }) {
  const t = useTranslations("student.payment.history");
  const locale = useLocale() as Locale;
  const newestFirst = [...payments].reverse();

  return (
    <Card>
      <CardHeader title={t("title")} />
      <CardBody>
        {newestFirst.length === 0 ? (
          <p className="text-body-sm text-ink-muted">{t("empty")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {newestFirst.map((payment) => (
              <li key={payment.payment_id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                <Receipt aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-teal" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-body-sm font-bold text-ink-strong">
                      {t("summary", {
                        method: t(payment.method),
                        amount: formatMoney(payment.amount_piasters, locale),
                      })}
                    </p>
                    <Badge tone={STATUS_TONE[payment.status]}>{t(payment.status)}</Badge>
                  </div>
                  <p className="text-caption text-ink-muted">
                    {t("details", {
                      reference: payment.reference_number,
                      date: formatDate(payment.submitted_at, locale),
                    })}
                  </p>
                  {payment.rejection_reason ? (
                    <p className="mt-1 text-body-sm text-danger-text">
                      {t("reason", { reason: payment.rejection_reason })}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
