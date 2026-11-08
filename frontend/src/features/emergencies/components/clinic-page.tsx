"use client";

import { Ambulance, HeartPulse, Siren, Stethoscope } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { StatTile } from "@/components/ui/stat-tile";
import { SosAction, SosStatus, SosType } from "@/features/sos/schema";
import type { Locale } from "@/i18n/routing";
import { formatNumber } from "@/lib/format";
import { AsyncStatus, useAsync } from "@/lib/hooks/use-async";
import { listAdminSos } from "../api";
import type { AdminSos } from "../schema";
import { EMERGENCIES_REFRESH_MS } from "./emergencies-page";
import { ActiveCase, CaseHistory, ClinicContacts } from "./clinic-cases";

/** The cases the clinic follows: someone on board needs a doctor, or an accident. */
const CLINIC_TYPES: readonly SosType[] = [SosType.Medical, SosType.Accident];
const MS_PER_DAY = 86_400_000;
const WEEK_DAYS = 7;

const isMedical = (sos: AdminSos) => CLINIC_TYPES.includes(sos.type);
export const hasAmbulance = (sos: AdminSos) =>
  sos.actions.some((entry) => entry.action === SosAction.AmbulanceCalled);

/** The clinic's desk: medical cases on the buses now, the week in numbers, and every case. */
export function ClinicPage() {
  const t = useTranslations("clinic");
  const state = useAsync((signal) => listAdminSos({}, { signal }), []);
  const { refresh } = state;

  useEffect(() => {
    const timer = window.setInterval(refresh, EMERGENCIES_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("lead")} />
      {state.status === AsyncStatus.Loading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : null}
      {state.status === AsyncStatus.Error ? (
        <ErrorState error={state.error} onRetry={state.reload} />
      ) : null}
      {state.status === AsyncStatus.Success ? (
        <ClinicView cases={state.data.items.filter(isMedical)} />
      ) : null}
    </div>
  );
}

function ClinicView({ cases }: { cases: AdminSos[] }) {
  const t = useTranslations("clinic");
  const locale = useLocale() as Locale;
  const active = cases.filter((sos) => sos.status !== SosStatus.Closed);
  // The week counts back from when the page was opened.
  const [weekStart] = useState(() => Date.now() - WEEK_DAYS * MS_PER_DAY);
  const thisWeek = cases.filter((sos) => Date.parse(sos.created_at) >= weekStart);

  return (
    <div className="grid grid-cols-1 items-start gap-5 desktop:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="flex min-w-0 flex-col gap-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <StatTile
            label={t("statActive")}
            value={formatNumber(active.length, locale)}
            icon={<Siren />}
          />
          <StatTile
            label={t("statWeek")}
            value={formatNumber(thisWeek.length, locale)}
            icon={<HeartPulse />}
          />
          <StatTile
            label={t("statAmbulance")}
            value={formatNumber(thisWeek.filter(hasAmbulance).length, locale)}
            caption={t("statAmbulanceCaption")}
            icon={<Ambulance />}
          />
        </div>
        <Card elevation="raised" aria-label={t("nowTitle")}>
          <CardHeader title={t("nowTitle")} headingLevel={2} />
          <CardBody>
            {active.length === 0 ? (
              <EmptyState
                icon={<Stethoscope />}
                title={t("nowEmptyTitle")}
                description={t("nowEmptyBody")}
              />
            ) : (
              <ul className="flex flex-col gap-3">
                {active.map((sos) => (
                  <li key={sos.id}>
                    <ActiveCase sos={sos} />
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
        <CaseHistory cases={cases} />
      </div>
      <ClinicContacts />
    </div>
  );
}
