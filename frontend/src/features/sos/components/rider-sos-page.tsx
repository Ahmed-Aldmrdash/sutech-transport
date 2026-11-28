"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Tone } from "@/components/ui/tone";
import { AsyncStatus, useAsync } from "@/lib/hooks/use-async";
import { getMyRiderSos } from "../api";
import { SosStatus, type RiderSosState } from "../schema";
import { Contacts } from "./sos-contacts";
import { SosFollow } from "./sos-follow";
import { SosPicker } from "./sos-picker";

/** How often the page checks that the trip is still running and for an alert on it. */
const RIDER_SOS_REFRESH_MS = 5000;

/** The student's emergency button: it works only while their line's trip is running. */
export function RiderSosPage() {
  const t = useTranslations("sos");
  const state = useAsync((signal) => getMyRiderSos({ signal }), []);
  const { refresh } = state;

  useEffect(() => {
    const timer = setInterval(refresh, RIDER_SOS_REFRESH_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("lead")} />
      <div className="grid grid-cols-1 items-start gap-5 desktop:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-5">
          {state.status === AsyncStatus.Loading ? <Skeleton className="h-72 w-full" /> : null}
          {state.status === AsyncStatus.Error ? (
            <ErrorState error={state.error} onRetry={state.reload} />
          ) : null}
          {state.status === AsyncStatus.Success ? (
            <RiderSosView state={state.data} refresh={refresh} />
          ) : null}
        </div>
        {/* The phone numbers stay on screen whatever happens above. */}
        <Contacts />
      </div>
    </div>
  );
}

function RiderSosView({ state, refresh }: { state: RiderSosState; refresh: () => void }) {
  const t = useTranslations("sos");
  const [sentId, setSentId] = useState<string | null>(null);
  // The alert just sent, until the trip shows it; then the trip's latest alert, even closed.
  const latest = state.sos;
  const followId = sentId ?? latest?.id ?? null;
  const isOpen =
    followId !== null && !(latest?.id === followId && latest.status === SosStatus.Closed);

  return (
    <>
      {state.trip_id !== null && !isOpen ? (
        <SosPicker
          tripId={state.trip_id}
          onSent={(sos) => {
            setSentId(sos.id);
            refresh();
          }}
        />
      ) : null}
      {followId ? <SosFollow key={followId} sosId={followId} /> : null}
      {state.trip_id === null && !followId ? (
        <Alert tone={Tone.Warning} title={t("riderNoTripTitle")}>
          {t("riderNoTripBody")}
        </Alert>
      ) : null}
    </>
  );
}
