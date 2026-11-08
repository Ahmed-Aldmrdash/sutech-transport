"use client";

import { Megaphone, Route, Timer, type LucideIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Tone } from "@/components/ui/tone";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime } from "@/lib/format";
import { AnnouncementKind, type Announcement } from "../schema";

const ANNOUNCEMENT_TONE: Record<AnnouncementKind, Tone> = {
  [AnnouncementKind.Official]: Tone.Brand,
  [AnnouncementKind.Delay]: Tone.Warning,
  [AnnouncementKind.ServiceChange]: Tone.Info,
};

const KIND_ICON: Record<AnnouncementKind, LucideIcon> = {
  [AnnouncementKind.Official]: Megaphone,
  [AnnouncementKind.Delay]: Timer,
  [AnnouncementKind.ServiceChange]: Route,
};

/** One announcement: kind, title, line (if any), text and date. */
export function AnnouncementItem({
  item,
  withTime = false,
  className,
}: {
  item: Announcement;
  /** The full page shows the time too; the home card only the day. */
  withTime?: boolean;
  className?: string;
}) {
  const t = useTranslations("student");
  const locale = useLocale() as Locale;
  const Icon = KIND_ICON[item.kind];
  return (
    <article className={cn("flex gap-3", className)}>
      <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-coral" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-body font-bold text-ink-strong">{item.title}</h3>
          <Badge tone={ANNOUNCEMENT_TONE[item.kind]}>{t(`home.alerts.kind.${item.kind}`)}</Badge>
          {item.line ? (
            <Badge tone={Tone.Neutral}>{t("lineCode", { code: item.line.code })}</Badge>
          ) : null}
        </div>
        <p className="mt-1 text-body-sm text-ink">{item.body}</p>
        <p className="mt-1 text-caption text-ink-muted">
          <time dateTime={item.published_at}>
            {withTime
              ? formatDateTime(item.published_at, locale)
              : formatDate(item.published_at, locale)}
          </time>
        </p>
      </div>
    </article>
  );
}
