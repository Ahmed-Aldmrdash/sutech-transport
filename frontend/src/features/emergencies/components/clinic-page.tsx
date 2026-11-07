"use client";

import { Ambulance, HeartPulse, Phone, Siren, Stethoscope } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { buttonStyles } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { StatTile } from "@/components/ui/stat-tile";
import { DataTable } from "@/components/ui/table";
import { EMERGENCY_CONTACTS } from "@/features/sos/contacts";
import { SosAction, SosStatus, SosType } from "@/features/sos/schema";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { formatDateTime, formatNumber, formatPhone } from "@/lib/format";
import { AsyncStatus, useAsync } from "@/lib/hooks/use-async";
import { listAdminSos } from "../api";
import type { AdminSos } from "../schema";
import { EMERGENCIES_REFRESH_MS } from "./emergencies-page";
import { SosStatusBadge } from "./sos-status-badge";

/** The cases the clinic follows: someone on board needs a doctor, or an accident. */
const CLINIC_TYPES: readonly SosType[] = [SosType.Medical, SosType.Accident];
const MS_PER_DAY = 86_400_000;
const WEEK_DAYS = 7;

const isMedical = (sos: AdminSos) => CLINIC_TYPES.includes(sos.type);
const hasAmbulance = (sos: AdminSos) =>
  sos.actions.some((entry) => entry.action === SosAction.AmbulanceCalled);
const summaryOf = (sos: AdminSos) =>
  sos.actions.findLast((entry) => entry.action === SosAction.Close)?.note ?? null;
const linkOf = (sos: AdminSos) => `/admin/emergencies/${encodeURIComponent(sos.id)}`;

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

function ActiveCase({ sos }: { sos: AdminSos }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  return (
    <div className="flex flex-col gap-3 rounded-card border border-danger p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-body font-bold text-ink-strong">
            {t(`sos.types.${sos.type}.label`)} ·{" "}
            {t("emergencies.lineName", { code: sos.line.code, name: sos.line.name })}
          </p>
          <SosStatusBadge status={sos.status} />
        </div>
        <p className="text-caption text-ink-muted">
          {formatDateTime(sos.created_at, locale)} ·{" "}
          {t("emergencies.onBoard", { count: formatNumber(sos.riders_on_board, locale) })}
        </p>
        {sos.note ? <p className="text-body-sm text-ink">{sos.note}</p> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <a
          href={`tel:${sos.driver.phone}`}
          className={buttonStyles({ variant: "secondary", size: "sm" })}
        >
          <Phone aria-hidden="true" className="size-4" />
          {t("clinic.callDriver")}
        </a>
        <Link href={linkOf(sos)} className={buttonStyles({ size: "sm" })}>
          {t("emergencies.open")}
        </Link>
      </div>
    </div>
  );
}

function CaseHistory({ cases }: { cases: AdminSos[] }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  return (
    <Card>
      <CardHeader title={t("clinic.historyTitle")} headingLevel={2} />
      <CardBody>
        <DataTable
          caption={t("clinic.historyTitle")}
          rows={cases}
          getRowKey={(sos) => sos.id}
          empty={<p className="text-body-sm text-ink-muted">{t("clinic.historyEmpty")}</p>}
          columns={[
            {
              key: "when",
              header: t("clinic.colWhen"),
              cell: (sos) => (
                <Link
                  href={linkOf(sos)}
                  className="font-bold text-brand underline-offset-2 focus-ring hover:underline"
                >
                  {formatDateTime(sos.created_at, locale)}
                </Link>
              ),
            },
            {
              key: "case",
              header: t("clinic.colCase"),
              cell: (sos) =>
                `${t(`sos.types.${sos.type}.label`)} · ${t("emergencies.lineName", {
                  code: sos.line.code,
                  name: sos.line.name,
                })}`,
            },
            {
              key: "status",
              header: t("clinic.colStatus"),
              cell: (sos) => <SosStatusBadge status={sos.status} />,
            },
            {
              key: "ambulance",
              header: t("clinic.colAmbulance"),
              cell: (sos) => (hasAmbulance(sos) ? t("clinic.yes") : t("clinic.no")),
            },
            {
              key: "summary",
              header: t("clinic.colSummary"),
              cell: (sos) => summaryOf(sos) ?? "—",
              className: "min-w-48",
            },
          ]}
        />
      </CardBody>
    </Card>
  );
}

function ClinicContacts() {
  const t = useTranslations();
  return (
    <Card>
      <CardHeader title={t("sos.contacts.title")} headingLevel={2} />
      <CardBody className="flex flex-col gap-3">
        {EMERGENCY_CONTACTS.map((contact) => (
          <a
            key={contact.key}
            href={`tel:${contact.phone}`}
            className={cn(
              buttonStyles({ variant: contact.key === "ambulance" ? "danger" : "secondary" }),
              "justify-between",
            )}
          >
            <span className="flex items-center gap-2">
              {contact.key === "ambulance" ? (
                <Ambulance aria-hidden="true" className="size-5" />
              ) : (
                <Phone aria-hidden="true" className="size-5" />
              )}
              {t(`sos.contacts.${contact.key}`)}
            </span>
            <bdi dir="ltr">
              {contact.phone.length > 6 ? formatPhone(contact.phone) : contact.phone}
            </bdi>
          </a>
        ))}
      </CardBody>
    </Card>
  );
}
