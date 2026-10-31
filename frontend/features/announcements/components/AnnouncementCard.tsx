"use client";

import type { ReactNode } from "react";
import { Pin } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Card } from "@/components/ui/Card";
import { Pill, type Tone } from "@/components/ui/Pill";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/time";
import { type Announcement, AnnouncementKind } from "../schema";

const TONE: Record<AnnouncementKind, Tone> = {
  [AnnouncementKind.Official]: "brand",
  [AnnouncementKind.Delay]: "warning",
  [AnnouncementKind.BusChange]: "teal",
  [AnnouncementKind.TimeChange]: "teal",
  [AnnouncementKind.BackOnSchedule]: "success",
  [AnnouncementKind.TripCancelled]: "danger",
  [AnnouncementKind.ExtraDeparture]: "teal",
};

export function AnnouncementCard({ item, actions }: { item: Announcement; actions?: ReactNode }) {
  const t = useTranslations("announcements");
  const locale = useLocale();
  return (
    <Card as="article" className={cn("flex flex-col gap-2", item.ended && "opacity-65")}>
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={TONE[item.kind]}>{t(`kind.${item.kind}`)}</Pill>
        {item.ended && <Pill>{t("ended")}</Pill>}
        {item.pinned && (
          <Pill tone="brand" icon={<Pin className="size-3" aria-hidden />}>
            {t("pinned")}
          </Pill>
        )}
        <span className="text-[13px] text-ink-muted">{item.target_name}</span>
      </div>
      {item.title && <h3 className="text-[17px] font-bold text-ink-strong">{item.title}</h3>}
      <p className="whitespace-pre-line text-ink">{item.text}</p>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-ink-muted">
        <span>
          {item.author} · <time dateTime={item.published_at}>{formatDateTime(item.published_at, locale)}</time>
        </span>
        {actions}
      </div>
    </Card>
  );
}
