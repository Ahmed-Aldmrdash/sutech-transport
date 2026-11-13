"use client";

import { CalendarDays, Clock, MapPin, Navigation, StickyNote, Users } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { Tone } from "@/components/ui/tone";
import { DeskRow } from "@/features/desk-kit/components/desk-row";
import { CallLink, Fact } from "@/features/emergencies/components/sos-facts";
import type { Locale } from "@/i18n/routing";
import { formatCalendarDate, formatClockTime, formatDateTime, formatNumber } from "@/lib/format";
import { EventStatus, type BusEvent, type EventBus } from "../schema";

const STATUS_TONE: Record<EventStatus, Tone> = {
  [EventStatus.WaitingCompany]: Tone.Warning,
  [EventStatus.Confirmed]: Tone.Success,
  [EventStatus.Declined]: Tone.Danger,
  [EventStatus.Cancelled]: Tone.Neutral,
};

export function EventStatusBadge({ event }: { event: BusEvent }) {
  const t = useTranslations("desk.events");
  if (event.is_past && event.status === EventStatus.Confirmed) {
    return <Badge tone={Tone.Neutral}>{t("status.done")}</Badge>;
  }
  return <Badge tone={STATUS_TONE[event.status]}>{t(`status.${event.status}`)}</Badge>;
}

/** "Thursday, Nov 15 · 7:30 AM to 3:00 PM" */
function useEventWhen() {
  const t = useTranslations("desk.events");
  const locale = useLocale() as Locale;
  return (event: Pick<BusEvent, "event_date" | "departs_at" | "returns_at">) =>
    event.returns_at
      ? t("whenRange", {
          date: formatCalendarDate(event.event_date, locale, "full"),
          from: formatClockTime(event.departs_at, locale),
          to: formatClockTime(event.returns_at, locale),
        })
      : t("whenOneWay", {
          date: formatCalendarDate(event.event_date, locale, "full"),
          from: formatClockTime(event.departs_at, locale),
        });
}

/** One request in a list, for the office or the company. */
export function EventRow({ event, href }: { event: BusEvent; href: string }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const when = useEventWhen();
  const waiting = event.status === EventStatus.WaitingCompany && !event.is_past;
  const confirmed = event.company_reply?.buses.length ?? 0;
  return (
    <DeskRow
      href={href}
      icon={<CalendarDays />}
      title={event.title}
      badge={<EventStatusBadge event={event} />}
      highlight={waiting}
      muted={event.is_past || event.status === EventStatus.Cancelled}
      lines={[
        when(event),
        [
          t(`desk.events.kinds.${event.kind}`),
          event.destination,
          t("desk.events.studentsValue", { count: formatNumber(event.students_count, locale) }),
          event.status === EventStatus.Confirmed
            ? t("desk.events.busesConfirmedValue", {
                confirmed: formatNumber(confirmed, locale),
                requested: formatNumber(event.buses_requested, locale),
              })
            : t("desk.events.busesValue", {
                count: formatNumber(event.buses_requested, locale),
                type: t(`student.busType.${event.bus_type}`),
              }),
          event.reference,
        ].join(" · "),
      ]}
    />
  );
}

/** What was asked for: when, where, how many. */
export function EventFacts({ event }: { event: BusEvent }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const when = useEventWhen();
  return (
    <Card elevation="raised">
      <CardHeader title={t("desk.events.detail.request")} headingLevel={2} />
      <CardBody>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Fact label={t("desk.events.detail.when")} icon={<Clock />}>
            {when(event)}
          </Fact>
          <Fact label={t("desk.events.detail.students")} icon={<Users />}>
            {t("desk.events.studentsValue", {
              count: formatNumber(event.students_count, locale),
            })}
          </Fact>
          <Fact label={t("desk.events.detail.pickup")} icon={<MapPin />}>
            {event.pickup}
          </Fact>
          <Fact label={t("desk.events.detail.destination")} icon={<Navigation />}>
            {event.destination}
          </Fact>
          <Fact label={t("desk.events.detail.buses")}>
            {t("desk.events.busesSeatsValue", {
              count: formatNumber(event.buses_requested, locale),
              type: t(`student.busType.${event.bus_type}`),
              seats: formatNumber(event.seats_requested, locale),
            })}
          </Fact>
          <Fact label={t("desk.events.detail.requestedBy")}>
            {t("desk.events.byAt", {
              name: event.requested_by_name,
              time: formatDateTime(event.created_at, locale),
            })}
          </Fact>
          {event.note ? (
            <Fact
              label={t("desk.events.detail.note")}
              icon={<StickyNote />}
              className="sm:col-span-2"
            >
              {event.note}
            </Fact>
          ) : null}
        </dl>
      </CardBody>
    </Card>
  );
}

/** The buses the company sends, each with its driver to call. */
export function EventBusesTable({ buses, caption }: { buses: EventBus[]; caption: string }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  return (
    <DataTable
      caption={caption}
      rows={buses}
      getRowKey={(bus) => bus.bus_id}
      columns={[
        {
          key: "plate",
          header: t("desk.events.table.plate"),
          cell: (bus) => <bdi className="font-bold text-ink-strong">{bus.plate}</bdi>,
        },
        {
          key: "type",
          header: t("desk.events.table.type"),
          cell: (bus) =>
            t("desk.events.typeSeats", {
              type: t(`student.busType.${bus.bus_type}`),
              seats: formatNumber(bus.seats, locale),
            }),
        },
        {
          key: "driver",
          header: t("desk.events.table.driver"),
          cell: (bus) => <CallLink name={bus.driver_name} phone={bus.driver_phone} />,
        },
      ]}
    />
  );
}
