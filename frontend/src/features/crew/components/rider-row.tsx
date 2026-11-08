"use client";

import { CircleCheck, LogOut } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Tone } from "@/components/ui/tone";
import { useToast } from "@/components/ui/toast";
import type { Locale } from "@/i18n/routing";
import { formatTime } from "@/lib/format";
import { useSubmit } from "@/lib/hooks/use-submit";
import { scanRider } from "../api";
import {
  CrewTripStatus,
  RiderState,
  ScanAction,
  ScanMethod,
  type CheckoutReason,
  type CrewTrip,
  type Rider,
} from "../schema";
import { CheckoutDialog } from "./checkout-dialog";
import { RiderStateBadge } from "./rider-state-badge";
import { SCAN_ERRORS } from "./scanner";

export function RiderRow({
  trip,
  rider,
  onChanged,
}: {
  trip: CrewTrip;
  rider: Rider;
  onChanged: () => void;
}) {
  const t = useTranslations("crew.passengers");
  const tScan = useTranslations("crew.scan");
  const tCheckout = useTranslations("crew.checkout");
  const tAbsence = useTranslations("student.notGoing.reasons");
  const locale = useLocale() as Locale;
  const toast = useToast();
  const [dialog, setDialog] = useState<ScanAction | null>(null);
  const { submit, isSending, serverError, clearServerError } = useSubmit(SCAN_ERRORS);
  const running = trip.status === CrewTripStatus.InProgress;
  const canBoard =
    running && (rider.state === RiderState.Waiting || rider.state === RiderState.NotGoing);
  const canCheckout = running && rider.state === RiderState.Boarded;

  async function send(action: ScanAction, reason: CheckoutReason | null, note: string | null) {
    const done = await submit((idempotencyKey) =>
      scanRider(
        trip.trip_id,
        {
          action,
          method: ScanMethod.Manual,
          qr_token: null,
          identifier: rider.identifier,
          reason,
          note,
        },
        { idempotencyKey },
      ),
    );
    if (done) {
      setDialog(null);
      toast.show({
        title:
          action === ScanAction.Board
            ? tScan("boardedResult", { name: rider.name })
            : tScan("checkedOutResult", { name: rider.name }),
        tone: Tone.Success,
      });
      onChanged();
    }
  }

  let detail: string | null = null;
  if (rider.state === RiderState.Boarded && rider.boarded_at) {
    detail = t("boardedAt", { time: formatTime(rider.boarded_at, locale) });
    if (rider.scan_method === ScanMethod.Manual) detail += ` · ${t("manual")}`;
  } else if (rider.state === RiderState.CheckedOut && rider.checked_out_at) {
    const reason = rider.checkout_reason ? tCheckout(`reasons.${rider.checkout_reason}`) : "";
    detail = `${t("leftAt", { time: formatTime(rider.checked_out_at, locale) })} · ${rider.checkout_note ?? reason}`;
  } else if (rider.state === RiderState.NotGoing && rider.not_going_reason) {
    detail = tAbsence(rider.not_going_reason);
  }

  const errorText = serverError ? tScan(`errors.${serverError}`) : null;
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line py-3 first:border-t-0">
      <div className="min-w-0 basis-full sm:flex-1 sm:basis-auto">
        <p className="text-body-sm font-bold text-ink-strong">{rider.name}</p>
        <p className="text-caption text-ink-muted">
          <bdi>{rider.identifier}</bdi>
          {detail ? ` · ${detail}` : ""}
        </p>
      </div>
      <RiderStateBadge state={rider.state} />
      <span className="flex-1 sm:hidden" aria-hidden="true" />
      {canBoard ? (
        <Button
          size="sm"
          variant="secondary"
          iconStart={<CircleCheck className="size-4" />}
          aria-label={t("boardNamed", { name: rider.name })}
          onClick={() => {
            clearServerError();
            setDialog(ScanAction.Board);
          }}
        >
          {t("board")}
        </Button>
      ) : null}
      {canCheckout ? (
        <Button
          size="sm"
          variant="secondary"
          iconStart={<LogOut className="size-4" />}
          aria-label={t("checkoutNamed", { name: rider.name })}
          onClick={() => {
            clearServerError();
            setDialog(ScanAction.Checkout);
          }}
        >
          {t("checkout")}
        </Button>
      ) : null}
      {errorText && dialog === null ? (
        <Alert tone={Tone.Danger} title={errorText} className="w-full" />
      ) : null}
      <ConfirmDialog
        open={dialog === ScanAction.Board}
        onClose={() => setDialog(null)}
        onConfirm={() => void send(ScanAction.Board, null, null)}
        isConfirming={isSending}
        title={t("boardConfirm", { name: rider.name })}
        description={t("boardConfirmBody")}
        confirmLabel={t("board")}
      >
        {errorText ? <Alert tone={Tone.Danger} title={errorText} /> : null}
      </ConfirmDialog>
      <CheckoutDialog
        open={dialog === ScanAction.Checkout}
        riderName={rider.name}
        isSending={isSending}
        error={errorText}
        onClose={() => setDialog(null)}
        onConfirm={(reason, note) => void send(ScanAction.Checkout, reason, note)}
      />
    </li>
  );
}
