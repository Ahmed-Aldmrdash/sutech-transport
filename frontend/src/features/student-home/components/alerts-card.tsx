"use client";

import { Megaphone } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { SkeletonLines } from "@/components/ui/skeleton";
import { Tone } from "@/components/ui/tone";
import { listAnnouncements } from "@/features/announcements/api";
import { AnnouncementKind } from "@/features/announcements/schema";
import type { Locale } from "@/i18n/routing";
import { formatDate } from "@/lib/format";
import { AsyncStatus, useAsync } from "@/lib/hooks/use-async";

const HOME_ALERT_COUNT = 3;

const KIND_TONE: Record<AnnouncementKind, Tone> = {
  [AnnouncementKind.Official]: Tone.Brand,
  [AnnouncementKind.Delay]: Tone.Warning,
  [AnnouncementKind.ServiceChange]: Tone.Info,
};

/** The latest few announcements: official notices, delays and changes on the student's line. */
export function AlertsCard() {
  const t = useTranslations("student.home.alerts");
  const locale = useLocale() as Locale;
  const state = useAsync(
    (signal) => listAnnouncements({ page_size: HOME_ALERT_COUNT }, { signal }),
    [],
  );

  return (
    <Card>
      <CardHeader title={t("title")} />
      <CardBody>
        {state.status === AsyncStatus.Loading ? <SkeletonLines lines={4} /> : null}
        {state.status === AsyncStatus.Error ? (
          <ErrorState error={state.error} onRetry={state.reload} />
        ) : null}
        {state.status === AsyncStatus.Success && state.data.items.length === 0 ? (
          <p className="text-body-sm text-ink-muted">{t("empty")}</p>
        ) : null}
        {state.status === AsyncStatus.Success && state.data.items.length > 0 ? (
          <ul className="flex flex-col divide-y divide-line">
            {state.data.items.map((item) => (
              <li key={item.announcement_id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                <Megaphone aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-coral" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-body font-bold text-ink-strong">{item.title}</h3>
                    <Badge tone={KIND_TONE[item.kind]}>{t(`kind.${item.kind}`)}</Badge>
                  </div>
                  <p className="mt-1 text-body-sm text-ink">{item.body}</p>
                  <p className="mt-1 text-caption text-ink-muted">
                    <time dateTime={item.published_at}>
                      {formatDate(item.published_at, locale)}
                    </time>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </CardBody>
    </Card>
  );
}
