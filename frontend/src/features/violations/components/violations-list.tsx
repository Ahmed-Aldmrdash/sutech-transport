"use client";

import { ShieldAlert } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Tone } from "@/components/ui/tone";
import type { Locale } from "@/i18n/routing";
import { formatDateTime } from "@/lib/format";
import { ViolationStatus, type Violation } from "../schema";

const STATUS_TONE: Record<Violation["status"], Tone> = {
  [ViolationStatus.Submitted]: Tone.Info,
  [ViolationStatus.UnderReview]: Tone.Warning,
  [ViolationStatus.Closed]: Tone.Neutral,
};

export function MyList({ items }: { items: Violation[] }) {
  const t = useTranslations("violations");
  const locale = useLocale() as Locale;
  if (items.length === 0) {
    return (
      <p className="flex items-center gap-2 text-body-sm text-ink-muted">
        <ShieldAlert aria-hidden="true" className="size-5 shrink-0" />
        {t("mineEmpty")}
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li
          key={item.violation_id}
          className="flex flex-col gap-1 rounded-md border border-line p-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-body-sm font-bold text-ink-strong">{t(`rules.${item.rule}`)}</p>
            <Badge tone={STATUS_TONE[item.status]}>{t(`status.${item.status}`)}</Badge>
          </div>
          <p className="text-caption text-ink-muted">
            {item.student ? `${item.student.name} · ` : ""}
            {formatDateTime(item.created_at, locale)}
          </p>
          <p className="text-body-sm text-ink">{item.description}</p>
        </li>
      ))}
    </ul>
  );
}
