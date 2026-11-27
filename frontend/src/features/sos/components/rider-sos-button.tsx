"use client";

import { Siren } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { ButtonLink } from "@/components/ui/button";
import { AsyncStatus, useAsync } from "@/lib/hooks/use-async";
import { getMyRiderSos } from "../api";

/** How often the button checks whether the trip started or ended. */
const RIDER_SOS_BUTTON_REFRESH_MS = 15_000;

/** The red SOS button on the student's pages, shown only while their trip is running. */
export function RiderSosButton() {
  const t = useTranslations("sos");
  const state = useAsync((signal) => getMyRiderSos({ signal }), []);
  const { refresh } = state;

  useEffect(() => {
    const timer = setInterval(refresh, RIDER_SOS_BUTTON_REFRESH_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  if (state.status !== AsyncStatus.Success || state.data.trip_id === null) return null;
  return (
    <ButtonLink
      href="/student/sos"
      variant="danger"
      size="sm"
      className="self-start"
      iconStart={<Siren aria-hidden="true" className="size-4" />}
    >
      {t("riderButton")}
    </ButtonLink>
  );
}
