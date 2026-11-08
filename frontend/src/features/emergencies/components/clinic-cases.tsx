"use client";

import { Ambulance, Phone } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { buttonStyles } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { EMERGENCY_CONTACTS } from "@/features/sos/contacts";
import { SosAction } from "@/features/sos/schema";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { formatDateTime, formatNumber, formatPhone } from "@/lib/format";
import type { AdminSos } from "../schema";
import { SosStatusBadge } from "./sos-status-badge";
import { hasAmbulance } from "./clinic-page";

const summaryOf = (sos: AdminSos) =>
  sos.actions.findLast((entry) => entry.action === SosAction.Close)?.note ?? null;

const linkOf = (sos: AdminSos) => `/admin/emergencies/${encodeURIComponent(sos.id)}`;

export function ActiveCase({ sos }: { sos: AdminSos }) {
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

export function CaseHistory({ cases }: { cases: AdminSos[] }) {
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

export function ClinicContacts() {
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
