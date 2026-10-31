"use client";

import { useTranslations } from "next-intl";
import type { RefundTier } from "@/features/term/schema";
import { cn } from "@/lib/cn";

/** The refund table from the term settings; the tier for the current week is highlighted. */
export function RefundPolicy({ policy, week }: { policy: RefundTier[]; week: number }) {
  const t = useTranslations("requests.policy");
  return (
    <table className="w-full text-[14px]">
      <caption className="mb-2 text-start font-bold text-ink-strong">{t("title")}</caption>
      <thead>
        <tr className="text-ink-muted">
          <th scope="col" className="py-1 text-start font-bold">{t("when")}</th>
          <th scope="col" className="py-1 text-end font-bold">{t("deduction")}</th>
        </tr>
      </thead>
      <tbody>
        {policy.map((tier) => {
          const current = week >= tier.from_week && (tier.to_week === null || week <= tier.to_week);
          const label =
            tier.from_week === 0 && tier.to_week === 0
              ? t("beforeStart")
              : tier.to_week === null
                ? t("fromWeek", { from: tier.from_week })
                : t("weeks", { from: tier.from_week, to: tier.to_week });
          return (
            <tr key={tier.from_week} className={cn("border-t border-line", current && "bg-brand-soft font-bold")}>
              <td className="px-1 py-2">
                {label}
                {current && <span className="ms-2 text-[12px] text-brand">{t("now")}</span>}
              </td>
              <td className="num px-1 py-2 text-end">{tier.deduction_percent === 100 ? t("noRefund") : `${tier.deduction_percent}%`}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
