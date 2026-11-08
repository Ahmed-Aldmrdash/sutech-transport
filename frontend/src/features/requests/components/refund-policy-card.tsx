"use client";

import { useLocale, useTranslations } from "next-intl";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { formatCalendarDate } from "@/lib/format";
import { type RefundPolicy } from "../schema";

/** The dated deduction table, today's row marked, and how the money comes back. */
export function PolicyCard({ policy }: { policy: RefundPolicy }) {
  const t = useTranslations("student.requests.refund");
  const locale = useLocale() as Locale;
  const day = (value: string) => formatCalendarDate(value, locale);

  return (
    <Card>
      <CardHeader title={t("policyTitle")} description={policy.term_name} />
      <CardBody className="flex flex-col gap-4">
        <ul className="flex flex-col gap-2">
          {policy.windows.map((window) => {
            const isToday = window.deduction_percent === policy.today_deduction_percent;
            return (
              <li
                key={window.from}
                className={cn(
                  "flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2.5",
                  isToday ? "border-brand bg-brand-soft" : "border-line",
                )}
              >
                <span className="text-body-sm text-ink-strong">
                  {window.to
                    ? t("windowRange", { from: day(window.from), to: day(window.to) })
                    : t("windowFrom", { from: day(window.from) })}
                </span>
                <span className="text-body-sm font-bold text-ink-strong">
                  {t("deductionValue", { percent: window.deduction_percent })}
                  {isToday ? <span className="ms-2 text-brand">{t("today")}</span> : null}
                </span>
              </li>
            );
          })}
        </ul>
        <ul className="flex list-disc flex-col gap-1.5 ps-5 text-body-sm text-ink">
          <li>{t("ruleCheque", { days: policy.payout_days })}</li>
          <li>{t("ruleProcessing", { days: policy.processing_days })}</li>
          <li>{t("ruleOriginalReceipt")}</li>
          <li>{t("ruleGuardian")}</li>
          <li>{t("ruleExceptional")}</li>
        </ul>
      </CardBody>
    </Card>
  );
}
