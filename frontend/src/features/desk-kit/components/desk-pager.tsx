"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/routing";
import { formatNumber } from "@/lib/format";

/** "21–40 of 57" with previous and next; hidden when everything fits on one page. */
export function DeskPager({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const t = useTranslations("desk.common.pager");
  const locale = useLocale() as Locale;
  if (total <= pageSize) return null;
  const last = Math.ceil(total / pageSize);
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav aria-label={t("label")} className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-body-sm text-ink-muted" aria-live="polite">
        {t("range", {
          from: formatNumber(from, locale),
          to: formatNumber(to, locale),
          total: formatNumber(total, locale),
        })}
      </p>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          iconStart={<ChevronLeft className="rtl:-scale-x-100" />}
        >
          {t("previous")}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={page >= last}
          onClick={() => onPage(page + 1)}
          iconEnd={<ChevronRight className="rtl:-scale-x-100" />}
        >
          {t("next")}
        </Button>
      </div>
    </nav>
  );
}
