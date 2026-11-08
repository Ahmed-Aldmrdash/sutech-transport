"use client";

import { ScanLine } from "lucide-react";
import { useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { CrewTripStatus, type CrewToday } from "../schema";
import { CrewGate } from "./crew-gate";
import { Scanner } from "./scanner";

/** Scanning passes on boarding, and when a student leaves the bus mid-trip. */
export function ScanPage() {
  const t = useTranslations("crew.scan");
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("lead")} />
      <CrewGate>{(today, refresh) => <ScanView today={today} refresh={refresh} />}</CrewGate>
    </div>
  );
}

function ScanView({ today, refresh }: { today: CrewToday; refresh: () => void }) {
  const t = useTranslations("crew.scan");
  const trip = today.trips.find((item) => item.status === CrewTripStatus.InProgress);
  if (!trip) {
    return (
      <EmptyState
        icon={<ScanLine />}
        title={t("noTripTitle")}
        description={t("noTripBody")}
        action={<ButtonLink href="/driver">{t("goToTrip")}</ButtonLink>}
      />
    );
  }
  return <Scanner trip={trip} onScanned={refresh} />;
}
