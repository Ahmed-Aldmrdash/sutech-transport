"use client";

import { CircleCheck, MapPin, Siren } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect } from "react";
import { LiveDot } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { formatNumber, formatTime } from "@/lib/format";
import { AsyncStatus, useAsync } from "@/lib/hooks/use-async";
import { getSos } from "../api";
import { SosActionLog } from "./sos-action-log";
import { SOS_TYPE_ICON } from "./sos-type";
import { SosAction, SosStatus } from "../schema";

/** How often an open SOS is re-read until the WebSocket is in place. */
const SOS_REFRESH_MS = 5000;

/** The alert after it was sent: who took it, and what the office did. */
export function SosFollow({ sosId }: { sosId: string }) {
  const t = useTranslations("sos");
  const locale = useLocale() as Locale;
  const state = useAsync((signal) => getSos(sosId, { signal }), [sosId]);
  const { refresh } = state;
  const isClosed = state.status === AsyncStatus.Success && state.data.status === SosStatus.Closed;

  useEffect(() => {
    if (isClosed) return;
    const timer = setInterval(refresh, SOS_REFRESH_MS);
    return () => clearInterval(timer);
  }, [refresh, isClosed]);

  if (state.status === AsyncStatus.Loading) return <Skeleton className="h-72 w-full" />;
  if (state.status === AsyncStatus.Error) {
    return <ErrorState error={state.error} onRetry={state.reload} />;
  }
  const sos = state.data;
  const Icon = SOS_TYPE_ICON[sos.type];
  const taken = sos.actions.find((entry) => entry.action === SosAction.Acknowledge);

  return (
    <Card elevation="raised">
      <CardBody className="flex flex-col gap-4">
        <div className="flex items-center gap-3 text-danger-text">
          <Siren aria-hidden="true" className="size-8 shrink-0" />
          <div className="min-w-0">
            <p className="text-h3">{t("sentTitle", { type: t(`types.${sos.type}.label`) })}</p>
            <p className="text-body-sm text-ink-muted">
              {t("sentAt", { time: formatTime(sos.created_at, locale) })}
            </p>
          </div>
        </div>

        <div
          role="status"
          aria-live="polite"
          className={cn(
            "flex items-center gap-3 rounded-card p-4 text-body font-bold",
            sos.status === SosStatus.Open
              ? "bg-warning-soft text-warning-text"
              : "bg-success-soft text-success-text",
          )}
        >
          {sos.status === SosStatus.Open ? (
            <LiveDot className="bg-warning" />
          ) : (
            <CircleCheck aria-hidden="true" className="size-6 shrink-0" />
          )}
          <span>
            {sos.status === SosStatus.Open ? t("statusOpen") : null}
            {sos.status === SosStatus.Acknowledged
              ? t("statusAcknowledged", {
                  name: taken?.by_name ?? "",
                  time: taken ? formatTime(taken.at, locale) : "",
                })
              : null}
            {sos.status === SosStatus.Closed ? t("statusClosed") : null}
          </span>
        </div>

        <dl className="grid gap-3 text-body-sm sm:grid-cols-2">
          <div className="flex items-start gap-2">
            <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-teal" />
            <div>
              <dt className="text-caption text-ink-muted">{t("type")}</dt>
              <dd className="font-bold text-ink-strong">{t(`types.${sos.type}.label`)}</dd>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <MapPin aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-teal" />
            <div>
              <dt className="text-caption text-ink-muted">{t("location")}</dt>
              <dd className="font-bold text-ink-strong">
                {sos.location ? (
                  <a
                    href={`https://www.google.com/maps?q=${sos.location.lat},${sos.location.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2 focus-ring"
                  >
                    <bdi dir="ltr">
                      {sos.location.lat.toFixed(5)}, {sos.location.lng.toFixed(5)}
                    </bdi>
                  </a>
                ) : (
                  t("noLocation")
                )}
              </dd>
              {sos.location ? (
                <dd className="text-caption text-ink-muted">
                  {t("fromGps", { time: formatTime(sos.location.fix_at, locale) })}
                </dd>
              ) : null}
            </div>
          </div>
          <div>
            <dt className="text-caption text-ink-muted">{t("onBoard")}</dt>
            <dd className="font-bold text-ink-strong">
              {formatNumber(sos.riders_on_board, locale)}
            </dd>
          </div>
          {sos.note ? (
            <div>
              <dt className="text-caption text-ink-muted">{t("note")}</dt>
              <dd className="text-ink-strong">{sos.note}</dd>
            </div>
          ) : null}
        </dl>
        <div className="flex flex-col gap-3 border-t border-line pt-4">
          <h3 className="text-body font-bold text-ink-strong">{t("log.title")}</h3>
          <SosActionLog actions={sos.actions} />
        </div>
        <p className="text-caption text-ink-muted">{t("whoKnows")}</p>
      </CardBody>
    </Card>
  );
}
