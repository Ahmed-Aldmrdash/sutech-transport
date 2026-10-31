"use client";

import { useState } from "react";
import { Flag, Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Segmented } from "@/components/ui/Segmented";
import { useErrorMessage } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { useMutation } from "@/lib/api/use-api";
import { endTrip, startTrip } from "../api";
import { type CrewTrip, RiderState } from "../schema";

/** Start and end the trip. Only the driver can do this; the server refuses the supervisor (403). */
export function TripControls({ trip }: { trip: CrewTrip }) {
  const t = useTranslations("crew.trip");
  const toast = useToast();
  const [direction, setDirection] = useState<CrewTrip["direction"]>(trip.direction);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const start = useMutation(startTrip);
  const end = useMutation(endTrip);
  const startError = useErrorMessage(start.error);
  const endError = useErrorMessage(end.error);
  const waiting = trip.riders.filter((rider) => rider.state === RiderState.Waiting).length;

  if (trip.state !== "in_progress") {
    return (
      <div className="flex flex-col gap-3">
        <Segmented
          label={t("direction")}
          value={direction}
          onChange={setDirection}
          options={[
            { value: "outbound", label: t("outbound") },
            { value: "return", label: t("return") },
          ]}
        />
        {startError && <p className="text-[14px] font-bold text-danger">{startError}</p>}
        <Button size="lg" block icon={<Play className="flip-rtl size-5" aria-hidden />} loading={start.pending} onClick={async () => (await start.run(trip.trip_id, direction)) && toast(t("started"))}>
          {t("start")}
        </Button>
      </div>
    );
  }
  return (
    <>
      <Button size="lg" block variant="secondary" icon={<Flag className="size-5" aria-hidden />} onClick={() => setConfirmEnd(true)}>
        {t("end")}
      </Button>
      <ConfirmDialog
        open={confirmEnd}
        title={t("endTitle")}
        confirmLabel={t("endConfirm")}
        pending={end.pending}
        error={endError || undefined}
        onClose={() => setConfirmEnd(false)}
        onConfirm={async () => {
          if (await end.run(trip.trip_id)) {
            setConfirmEnd(false);
            toast(t("ended"));
          }
        }}
      >
        <p>{trip.direction === "outbound" ? t("endBodyOutbound", { count: waiting }) : t("endBodyReturn")}</p>
      </ConfirmDialog>
    </>
  );
}
