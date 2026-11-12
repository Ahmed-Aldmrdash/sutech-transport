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
import { formatDateTime } from "@/lib/format";
import { AsyncStatus, useAsync } from "@/lib/hooks/use-async";
import { getCompanyRequest } from "../api";
import { EventStatus, type BusEvent } from "../schema";
import { CompanyReplyCard } from "./company-reply-card";
import { EventBusesTable, EventFacts, EventStatusBadge } from "./event-parts";

/** One request as Abu El Hol sees it, and its answer: which buses go, or why none can. */
export function CompanyRequestPage({ eventId }: { eventId: string }) {
  const t = useTranslations("desk.company");
  const tEvents = useTranslations("desk.events");
  const state = useAsync((signal) => getCompanyRequest(eventId, { signal }), [eventId]);
  const back = <BackLink href="/admin/bus-company">{t("back")}</BackLink>;

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
  const { event, available_buses: available } = state.data;
  const canReply = event.allowed_actions.length > 0;
  return (
    <div className="flex flex-col gap-6">
      {back}
      <PageHeader
        eyebrow={`${tEvents(`kinds.${event.kind}`)} · ${event.reference}`}
        title={event.title}
        actions={<EventStatusBadge event={event} />}
      />
      <Answer event={event} />
      <div className="grid items-start gap-5 desktop:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <EventFacts event={event} />
        {canReply ? (
          <CompanyReplyCard event={event} available={available} onDone={state.refresh} />
        ) : event.company_reply && event.company_reply.buses.length > 0 ? (
          <Card>
            <CardHeader title={t("sentBuses")} headingLevel={2} />
            <CardBody>
              <EventBusesTable buses={event.company_reply.buses} caption={t("sentBuses")} />
            </CardBody>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

function Answer({ event }: { event: BusEvent }) {
  const t = useTranslations("desk.company.answer");
  const locale = useLocale() as Locale;
  if (event.cancellation) {
    return (
      <Alert tone={Tone.Info} title={t("cancelled")}>
        <span className="block">{event.cancellation.reason}</span>
        <span className="mt-1 block text-caption">
          {formatDateTime(event.cancellation.at, locale)}
        </span>
      </Alert>
    );
  }
  const reply = event.company_reply;
  if (!reply) {
    return event.is_past ? <Alert tone={Tone.Info} title={t("expired")} /> : null;
  }
  return (
    <Alert
      tone={event.status === EventStatus.Confirmed ? Tone.Success : Tone.Info}
      title={event.status === EventStatus.Confirmed ? t("confirmed") : t("declined")}
    >
      {reply.note ? <span className="block">{reply.note}</span> : null}
      <span className="mt-1 block text-caption">
        {t("byAt", { name: reply.by_name, time: formatDateTime(reply.at, locale) })}
      </span>
    </Alert>
  );
}
