"use client";

import { Bus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Tone } from "@/components/ui/tone";
import { listCompanyRequests } from "../api";
import { EventList } from "./event-list";

/** Abu El Hol's portal: the office's requests for buses, and its own fleet. No student data. */
export function CompanyPortalPage() {
  const t = useTranslations("desk.company");
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        description={t("lead")}
        actions={
          <ButtonLink href="/admin/bus-company/fleet" variant="secondary" iconStart={<Bus />}>
            {t("fleetLink")}
          </ButtonLink>
        }
      />
      <Alert tone={Tone.Info} title={t("privacy")} />
      <EventList
        load={listCompanyRequests}
        hrefOf={(eventId) => `/admin/bus-company/${encodeURIComponent(eventId)}`}
      />
    </div>
  );
}
