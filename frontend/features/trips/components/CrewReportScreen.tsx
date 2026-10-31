"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { Async } from "@/components/ui/Async";
import { ViolationForm } from "@/features/violations/components/ViolationForm";
import { DelayForm } from "./DelayForm";
import { useCrewTrip } from "./useCrewTrip";

export function CrewReportScreen() {
  const t = useTranslations("crew");
  const query = useCrewTrip();
  return (
    <>
      <PageHeader title={t("reportTitle")} subtitle={t("reportSubtitle")} />
      <div className="flex flex-col gap-4">
        <Async query={query}>{(trip) => <DelayForm trip={trip} />}</Async>
        <ViolationForm />
      </div>
    </>
  );
}
