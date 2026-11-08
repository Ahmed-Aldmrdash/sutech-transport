"use client";

import { Flag, Play } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Tone } from "@/components/ui/tone";
import { useToast } from "@/components/ui/toast";
import { TripDirection } from "@/features/trips/schema";
import type { Locale } from "@/i18n/routing";
import { formatNumber } from "@/lib/format";
import { useSubmit } from "@/lib/hooks/use-submit";
import { endTrip, startTrip } from "../api";
import { CrewErrorCode, type CrewToday, type CrewTrip } from "../schema";
import { isBlockedByOtherTrip, waitingRiders } from "../trip-rules";

const TRIP_ERRORS = [
  CrewErrorCode.TripAlreadyStarted,
  CrewErrorCode.TripAlreadyEnded,
  CrewErrorCode.TripNotStarted,
  CrewErrorCode.OtherTripInProgress,
] as const;

export function StartButton({
  today,
  trip,
  onChanged,
  compact,
}: {
  today: CrewToday;
  trip: CrewTrip;
  onChanged: () => void;
  compact?: boolean;
}) {
  const t = useTranslations("crew.trip");
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const { submit, isSending, serverError } = useSubmit(TRIP_ERRORS);
  const blocked = isBlockedByOtherTrip(today, trip);

  async function start() {
    const started = await submit((idempotencyKey) => startTrip(trip.trip_id, { idempotencyKey }));
    setConfirming(false);
    if (started) {
      toast.show({ title: t("startedToast"), tone: Tone.Success });
      onChanged();
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        size={compact ? "sm" : "lg"}
        variant={compact ? "secondary" : "primary"}
        withArrow={!compact}
        className="self-start"
        disabled={blocked}
        iconStart={compact ? <Play className="size-4" /> : undefined}
        onClick={() => setConfirming(true)}
      >
        {trip.direction === TripDirection.Outbound ? t("startOutbound") : t("startReturn")}
      </Button>
      {blocked ? <p className="text-caption text-ink-muted">{t("blocked")}</p> : null}
      {serverError ? <Alert tone={Tone.Danger} title={t(`errors.${serverError}`)} /> : null}
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => void start()}
        isConfirming={isSending}
        title={
          trip.direction === TripDirection.Outbound
            ? t("startOutboundConfirm")
            : t("startReturnConfirm")
        }
        description={t("startConfirmBody")}
        confirmLabel={t("startConfirm")}
      />
    </div>
  );
}

export function EndButton({ trip, onChanged }: { trip: CrewTrip; onChanged: () => void }) {
  const t = useTranslations("crew.trip");
  const locale = useLocale() as Locale;
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const { submit, isSending, serverError } = useSubmit(TRIP_ERRORS);
  const waiting = waitingRiders(trip).length;

  async function end() {
    const ended = await submit((idempotencyKey) => endTrip(trip.trip_id, { idempotencyKey }));
    setConfirming(false);
    if (ended) {
      toast.show({ title: t("endedToast"), tone: Tone.Success });
      onChanged();
    }
  }

  return (
    <div className="flex flex-col gap-2 border-t border-line pt-4">
      <Button
        variant="secondary"
        className="self-start"
        iconStart={<Flag className="size-4" />}
        onClick={() => setConfirming(true)}
      >
        {trip.direction === TripDirection.Outbound ? t("endOutbound") : t("endReturn")}
      </Button>
      {serverError ? <Alert tone={Tone.Danger} title={t(`errors.${serverError}`)} /> : null}
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => void end()}
        isConfirming={isSending}
        title={t("endConfirm")}
        description={
          waiting > 0
            ? t("endConfirmWaiting", { count: waiting, number: formatNumber(waiting, locale) })
            : t("endConfirmAll")
        }
        confirmLabel={t("endConfirmButton")}
      />
    </div>
  );
}
