"use client";

import { BusFront, Users } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect } from "react";
import { BackLink } from "@/components/ui/back-link";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { SosActionLog } from "@/features/sos/components/sos-action-log";
import { SosStatus } from "@/features/sos/schema";
import type { Locale } from "@/i18n/routing";
import { formatDateTime, formatNumber } from "@/lib/format";
import { AsyncStatus, useAsync } from "@/lib/hooks/use-async";
import { getAdminSos } from "../api";
import type { AdminSos } from "../schema";
import { EMERGENCIES_REFRESH_MS } from "./emergencies-page";
import { SosActionsCard } from "./sos-actions-card";
import { CallLink, Fact, LocationCard } from "./sos-facts";
import { SosStatusBadge } from "./sos-status-badge";
import { StatusBanner } from "./sos-status-banner";

/** One alert for the office: where the bus is, who to call, what was done, and what to do next. */
export function EmergencyDetailPage({ sosId }: { sosId: string }) {
  const t = useTranslations("emergencies");
  const state = useAsync((signal) => getAdminSos(sosId, { signal }), [sosId]);
  const { refresh } = state;
  const isClosed = state.status === AsyncStatus.Success && state.data.status === SosStatus.Closed;

  useEffect(() => {
    if (isClosed) return;
    const timer = window.setInterval(refresh, EMERGENCIES_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [refresh, isClosed]);

  const back = <BackLink href="/admin/emergencies">{t("back")}</BackLink>;
  if (state.status === AsyncStatus.Loading) {
    return (
      <div className="flex flex-col gap-6">
        {back}
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }
  if (state.status === AsyncStatus.Error) {
    return (
      <div className="flex flex-col gap-6">
        {back}
        <ErrorState
          error={state.error}
          onRetry={state.reload}
          headingLevel={1}
          action={<ButtonLink href="/admin/emergencies">{t("allAlerts")}</ButtonLink>}
        />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      {back}
      <SosView sos={state.data} onChanged={refresh} />
    </div>
  );
}

function SosView({ sos, onChanged }: { sos: AdminSos; onChanged: () => void }) {
  const t = useTranslations("emergencies");
  const tRoot = useTranslations();
  const locale = useLocale() as Locale;

  return (
    <>
      <PageHeader
        eyebrow={`${tRoot(`emergencies.direction.${sos.direction}`)} · ${formatDateTime(sos.created_at, locale)}`}
        title={`${tRoot(`sos.types.${sos.type}.label`)} · ${t("lineName", { code: sos.line.code, name: sos.line.name })}`}
        actions={<SosStatusBadge status={sos.status} />}
      />
      <StatusBanner sos={sos} onChanged={onChanged} />
      <div className="grid items-start gap-5 desktop:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-5">
          <LocationCard sos={sos} />
          <Card>
            <CardHeader title={t("busTitle")} headingLevel={2} />
            <CardBody>
              <dl className="grid gap-4 sm:grid-cols-2">
                <Fact label={t("bus")} icon={<BusFront />}>
                  {t("busLine", {
                    plate: sos.bus.plate,
                    type: tRoot(`student.busType.${sos.bus.bus_type}`),
                    seats: formatNumber(sos.bus.seats, locale),
                  })}
                </Fact>
                <Fact label={t("ridersOnBoard")} icon={<Users />}>
                  {formatNumber(sos.riders_on_board, locale)}
                </Fact>
                <Fact label={t("driver")}>
                  <CallLink name={sos.driver.name} phone={sos.driver.phone} />
                </Fact>
                <Fact label={t("raisedByTitle")}>
                  <span className="block">
                    {t("raisedBy", {
                      role: tRoot(`roles.${sos.raised_by.role}`),
                      name: sos.raised_by.name,
                    })}
                  </span>
                  {sos.raised_by_phone && sos.raised_by_phone !== sos.driver.phone ? (
                    <CallLink name={sos.raised_by.name} phone={sos.raised_by_phone} />
                  ) : null}
                </Fact>
                {sos.note ? (
                  <Fact label={t("crewNote")} className="sm:col-span-2">
                    {sos.note}
                  </Fact>
                ) : null}
              </dl>
            </CardBody>
          </Card>
        </div>
        <div className="flex flex-col gap-5">
          {sos.status === SosStatus.Closed ? null : (
            <SosActionsCard sos={sos} onChanged={onChanged} />
          )}
          <Card>
            <CardHeader title={tRoot("sos.log.title")} headingLevel={2} />
            <CardBody>
              <SosActionLog actions={sos.actions} />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
