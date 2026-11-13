"use client";

import { Gauge, MapPin, Users, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { IconButton } from "@/components/ui/icon-button";
import { Tone } from "@/components/ui/tone";
import { CallLink, Fact } from "@/features/emergencies/components/sos-facts";
import type { Locale } from "@/i18n/routing";
import { formatNumber, todayInCairo } from "@/lib/format";
import { LiveBusStatus, type LiveBus } from "../schema";
import { ChangeCrewButton } from "./change-crew-button";
import { LIVE_STATUS_TONE } from "./live-bus-list";

const PERCENT = 100;

/** The chosen bus: its driver to call, where it is, who rode, and changing its crew. */
export function LiveBusCard({
  bus,
  onClose,
  onChanged,
}: {
  bus: LiveBus;
  onClose: () => void;
  onChanged: () => void;
}) {
  const t = useTranslations("desk.ops.live");
  const locale = useLocale() as Locale;
  const number = (value: number) => formatNumber(value, locale);
  const canChange =
    bus.trip_id !== null &&
    (bus.status === LiveBusStatus.NotStarted || bus.status === LiveBusStatus.OnTheRoad);
  return (
    <Card elevation="raised">
      <CardHeader
        title={t("lineValue", { code: bus.line.code, name: bus.line.name })}
        headingLevel={2}
        actions={<IconButton label={t("closeCard")} icon={<X />} size="sm" onClick={onClose} />}
      />
      <CardBody className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <Badge tone={LIVE_STATUS_TONE[bus.status]}>{t(`statuses.${bus.status}`)}</Badge>
          {bus.sos_open ? <Badge tone={Tone.Danger}>{t("sos")}</Badge> : null}
          {bus.delay_minutes ? (
            <Badge tone={Tone.Warning}>{t("late", { minutes: number(bus.delay_minutes) })}</Badge>
          ) : null}
        </div>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Fact label={t("driver")}>
            <CallLink name={bus.bus.driver_name} phone={bus.bus.driver_phone} />
          </Fact>
          <Fact label={t("bus")}>
            <bdi>{bus.bus.plate}</bdi>
            {bus.replaced ? ` · ${t("replaced")}` : ""}
          </Fact>
          <Fact label={t("where")} icon={<MapPin />}>
            {bus.near_stop ? t("near", { stop: bus.near_stop }) : t(`statuses.${bus.status}`)}
          </Fact>
          <Fact label={t("progress")} icon={<Gauge />}>
            {t("progressValue", {
              percent: number(Math.round(bus.progress * PERCENT)),
              speed: number(bus.position?.speed_kmh ?? 0),
            })}
          </Fact>
          <Fact label={t("riders")} icon={<Users />}>
            {t("rode", { rode: number(bus.rode), subscribers: number(bus.subscribers) })}
          </Fact>
        </dl>
        <div className="flex flex-wrap gap-3">
          <ButtonLink
            href={`/admin/attendance?line=${bus.line.line_id}&date=${todayInCairo()}`}
            variant="secondary"
            size="sm"
          >
            {t("whoRode")}
          </ButtonLink>
          {canChange && bus.trip_id ? (
            <ChangeCrewButton tripId={bus.trip_id} onChanged={onChanged} size="sm" />
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}
