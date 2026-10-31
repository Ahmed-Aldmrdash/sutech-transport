"use client";

import { ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { Async } from "@/components/ui/Async";
import { Banner } from "@/components/ui/Banner";
import { Card, CardTitle } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { EmptyState } from "@/components/ui/States";
import { useCrewTrip } from "@/features/trips/components/useCrewTrip";
import { useApi, usePolling } from "@/lib/api/use-api";
import { useLive } from "@/lib/realtime";
import { getSos } from "../api";
import { SosLog } from "./SosLog";

const SOS_REFRESH_MS = 5000;

/** What the crew sees after raising an SOS: whether the office saw it and what it did. */
export function CrewSosStatus() {
  const t = useTranslations("crew.sos");
  const trip = useCrewTrip();
  const sosId = trip.data?.open_sos_id ?? null;
  return (
    <>
      <PageHeader title={t("statusTitle")} back="/driver" backLabel={t("back")} />
      <Async query={trip}>
        {() => (sosId ? <SosDetail id={sosId} /> : <EmptyState icon={<ShieldCheck className="size-8" aria-hidden />} title={t("noneOpen")} />)}
      </Async>
    </>
  );
}

function SosDetail({ id }: { id: string }) {
  const t = useTranslations("crew.sos");
  const query = useApi(() => getSos(id), [id]);
  usePolling(query.reload, SOS_REFRESH_MS);
  useLive("sos.update", () => undefined);
  return (
    <Async query={query}>
      {(sos) => (
        <div className="flex flex-col gap-4">
          <Banner tone={sos.status === "new" ? "danger" : "warning"} title={t(`status.${sos.status}`)}>
            {sos.status === "new" ? t("waitingOffice") : t("officeOnIt")}
          </Banner>
          <Card>
            <CardTitle action={<Pill tone="danger">{t(`kinds.${sos.kind}`)}</Pill>}>{sos.line_name}</CardTitle>
            {sos.note && <p className="mb-3 rounded-md bg-surface-alt p-3">{sos.note}</p>}
            {sos.ambulance_requested && <Banner className="mb-3" tone="info">{t("ambulance")}</Banner>}
            {sos.replacement_bus_plate && <Banner className="mb-3" tone="info">{t("replacement", { plate: sos.replacement_bus_plate })}</Banner>}
            <SosLog log={sos.log} />
          </Card>
          <Banner tone="info">{t("emergencyNumbers")}</Banner>
        </div>
      )}
    </Async>
  );
}
