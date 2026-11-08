"use client";

import { useLocale, useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Tone } from "@/components/ui/tone";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { RequestActor, RequestStatus, type RequestEvent, type StudentRequest } from "../schema";
import { REQUEST_STATUS_TONE } from "./request-status-badge";

/** The office's last word, on top where the student looks first. */
export function LatestAnswer({ request }: { request: StudentRequest }) {
  const t = useTranslations("student.requests.detail");
  const last = request.timeline.at(-1);
  if (last?.status === RequestStatus.Withdrawn) {
    return <Alert tone={Tone.Info} title={t("answer.withdrawn")} />;
  }
  if (request.status === RequestStatus.AwaitingGuardian) {
    return (
      <Alert tone={Tone.Warning} title={t("guardianWaitingTitle")}>
        {t("guardianWaitingBody")}
      </Alert>
    );
  }
  if (!last || last.by === RequestActor.Student || request.status === RequestStatus.Submitted) {
    return request.status === RequestStatus.Submitted ? (
      <Alert tone={Tone.Info} title={t("waitingTitle")}>
        {t("waitingBody")}
      </Alert>
    ) : null;
  }
  if (last.by === RequestActor.Guardian) {
    return (
      <Alert tone={Tone.Danger} title={t("guardianRefused")}>
        {last.note ?? null}
      </Alert>
    );
  }
  const tone = REQUEST_STATUS_TONE[last.status];
  const alertTone =
    tone === Tone.Success || tone === Tone.Danger || tone === Tone.Warning ? tone : Tone.Info;
  return (
    <Alert tone={alertTone} title={t(`answer.${last.status}`)}>
      {last.note ?? t("noNote")}
    </Alert>
  );
}

export function Timeline({ events }: { events: readonly RequestEvent[] }) {
  const t = useTranslations("student.requests");
  const locale = useLocale() as Locale;
  return (
    <Card>
      <CardHeader title={t("detail.historyTitle")} />
      <CardBody>
        <ol className="flex flex-col">
          {events.map((event, index) => {
            const isLast = index === events.length - 1;
            return (
              <li
                key={`${event.status}-${event.at}`}
                className="relative flex gap-3 pb-5 last:pb-0"
              >
                {!isLast ? (
                  <span
                    aria-hidden="true"
                    className="absolute start-[7px] top-5 bottom-0 w-0.5 bg-line"
                  />
                ) : null}
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-1 size-4 shrink-0 rounded-full border-2",
                    isLast ? "border-brand bg-brand" : "border-line-strong bg-surface-raised",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-body-sm font-bold text-ink-strong">
                    {event.by === RequestActor.Guardian
                      ? t(
                          event.status === RequestStatus.Rejected
                            ? "detail.guardianRefused"
                            : "detail.guardianApproved",
                        )
                      : t(`status.${event.status}`)}
                  </p>
                  <p className="text-caption text-ink-muted">
                    {t("detail.eventMeta", {
                      by: t(`detail.by.${event.by}`),
                      date: formatDateTime(event.at, locale),
                    })}
                  </p>
                  {event.note ? <p className="mt-1 text-body-sm text-ink">{event.note}</p> : null}
                </div>
              </li>
            );
          })}
        </ol>
      </CardBody>
    </Card>
  );
}
