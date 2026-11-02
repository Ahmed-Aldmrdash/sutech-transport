"use client";

import { useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { SkeletonLines } from "@/components/ui/skeleton";
import { listAnnouncements } from "@/features/announcements/api";
import { AnnouncementItem } from "@/features/announcements/components/announcement-item";
import { AsyncStatus, useAsync } from "@/lib/hooks/use-async";

const HOME_ALERT_COUNT = 3;

/** The latest few announcements: official notices, delays and changes on the student's line. */
export function AlertsCard() {
  const t = useTranslations("student.home.alerts");
  const state = useAsync(
    (signal) => listAnnouncements({ page_size: HOME_ALERT_COUNT }, { signal }),
    [],
  );

  return (
    <Card>
      <CardHeader
        title={t("title")}
        actions={
          <ButtonLink href="/student/announcements" variant="ghost" size="sm">
            {t("seeAll")}
          </ButtonLink>
        }
      />
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
              <li key={item.announcement_id} className="py-3 first:pt-0 last:pb-0">
                <AnnouncementItem item={item} />
              </li>
            ))}
          </ul>
        ) : null}
      </CardBody>
    </Card>
  );
}
