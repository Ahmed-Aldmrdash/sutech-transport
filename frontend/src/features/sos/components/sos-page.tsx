"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { Tone } from "@/components/ui/tone";
import { CrewGate } from "@/features/crew/components/crew-gate";
import { CrewTripStatus, type CrewToday } from "@/features/crew/schema";
import { currentTrip } from "@/features/crew/trip-rules";
import { SosStatus } from "../schema";
import { SosFollow } from "./sos-follow";
import { Contacts } from "./sos-contacts";
import { SosPicker } from "./sos-picker";

/** The emergency button: pick what happened, and the office gets the bus's GPS position. */
export function SosPage() {
  const t = useTranslations("sos");
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("lead")} />
      <CrewGate>{(today, refresh) => <SosView today={today} refresh={refresh} />}</CrewGate>
    </div>
  );
}

function SosView({ today, refresh }: { today: CrewToday; refresh: () => void }) {
  const t = useTranslations("sos");
  const trip = currentTrip(today);
  const [sentId, setSentId] = useState<string | null>(null);
  // The alert just sent, until the trip shows it; then the trip's latest alert, even closed.
  const latest = trip?.sos ?? null;
  const followId = sentId ?? latest?.id ?? null;
  const isOpen =
    followId !== null && !(latest?.id === followId && latest.status === SosStatus.Closed);
  const canRaise = trip !== null && trip.status !== CrewTripStatus.Ended && !isOpen;

  return (
    <div className="grid items-start gap-5 desktop:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="flex flex-col gap-5">
        {canRaise ? (
          <SosPicker
            trip={trip}
            onSent={(sos) => {
              setSentId(sos.id);
              refresh();
            }}
          />
        ) : null}
        {followId ? <SosFollow key={followId} sosId={followId} /> : null}
        {!canRaise && !followId ? (
          <Alert tone={Tone.Warning} title={t("noTripTitle")}>
            {t("noTripBody")}
          </Alert>
        ) : null}
      </div>
      <Contacts />
    </div>
  );
}
