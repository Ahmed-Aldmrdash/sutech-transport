"use client";

import { useLocale, useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { BackLink } from "@/components/ui/back-link";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Tone } from "@/components/ui/tone";
import type { Locale } from "@/i18n/routing";
import { formatDateTime, formatNumber } from "@/lib/format";
import { AsyncStatus, useAsync } from "@/lib/hooks/use-async";
import { getEvent } from "../api";
import { EventAction, EventStatus, type BusEvent } from "../schema";
import { CancelEventCard } from "./cancel-event-card";
import { EventBusesTable, EventFacts, EventStatusBadge } from "./event-parts";

/** One request: what was asked, Abu El Hol's answer, and calling it off. */
export function EventDetailPage({ eventId }: { eventId: string }) {
  const t = useTranslations("desk.events");
  const state = useAsync((signal) => getEvent(eventId, { signal }), [eventId]);
  const back = <BackLink href="/admin/events">{t("back")}</BackLink>;

  if (state.status === AsyncStatus.Loading) {
    return (
      <div className="flex flex-col gap-6">
        {back}
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (state.status === AsyncStatus.Error) {
    return (
      <div className="flex flex-col gap-6">
        {back}
        <ErrorState error={state.error} onRetry={state.reload} />
      </div>
    );
  }
  const event = state.data;
  return (
    <div className="flex flex-col gap-6">
      {back}
      <PageHeader
        eyebrow={`${t(`kinds.${event.kind}`)} · ${event.reference}`}
        title={event.title}
        actions={<EventStatusBadge event={event} />}
      />
      <CompanyAnswer event={event} />
      <div className="grid items-start gap-5 desktop:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-5">
          <EventFacts event={event} />
          {event.company_reply && event.company_reply.buses.length > 0 ? (
            <Card>
              <CardHeader title={t("detail.busesSent")} headingLevel={2} />
              <CardBody>
                <EventBusesTable
                  buses={event.company_reply.buses}
                  caption={t("detail.busesSent")}
                />
              </CardBody>
            </Card>
          ) : null}
        </div>
        {event.allowed_actions.includes(EventAction.Cancel) ? (
          <CancelEventCard event={event} onDone={state.refresh} />
        ) : null}
      </div>
    </div>
  );
}

/** Waiting, confirmed (all or part), declined or cancelled, in one line with who and when. */
function CompanyAnswer({ event }: { event: BusEvent }) {
  const t = useTranslations("desk.events.detail");
  const locale = useLocale() as Locale;
  const reply = event.company_reply;
  if (event.cancellation) {
    return (
      <Alert tone={Tone.Info} title={t("cancelledTitle")}>
        <span className="block">{event.cancellation.reason}</span>
        <span className="mt-1 block text-caption">
          {t("byAt", {
            name: event.cancellation.by_name,
            time: formatDateTime(event.cancellation.at, locale),
          })}
        </span>
      </Alert>
    );
  }
  if (!reply) {
    return (
      <Alert tone={Tone.Warning} title={event.is_past ? t("noAnswerPast") : t("waitingTitle")}>
        {event.is_past ? null : t("waitingBody")}
      </Alert>
    );
  }
  const confirmed = event.status === EventStatus.Confirmed;
  const partial = confirmed && reply.buses.length < event.buses_requested;
  return (
    <Alert
      tone={!confirmed ? Tone.Danger : partial ? Tone.Warning : Tone.Success}
      title={
        !confirmed
          ? t("declinedTitle")
          : partial
            ? t("partialTitle", {
                confirmed: formatNumber(reply.buses.length, locale),
                requested: formatNumber(event.buses_requested, locale),
              })
            : t("confirmedTitle")
      }
    >
      {reply.note ? <span className="block">{reply.note}</span> : null}
      {partial ? <span className="block">{t("partialBody")}</span> : null}
      <span className="mt-1 block text-caption">
        {t("byAt", { name: reply.by_name, time: formatDateTime(reply.at, locale) })}
      </span>
    </Alert>
  );
}
