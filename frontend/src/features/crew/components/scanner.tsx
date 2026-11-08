"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Card, CardBody } from "@/components/ui/card";
import { FilterChips } from "@/components/ui/filter-chips";
import type { Locale } from "@/i18n/routing";
import { formatNumber } from "@/lib/format";
import { useSubmit } from "@/lib/hooks/use-submit";
import { scanRider } from "../api";
import {
  CrewErrorCode,
  ScanAction,
  ScanMethod,
  type CheckoutReason,
  type CrewTrip,
  type Rider,
  type RiderCounts,
} from "../schema";
import { CheckoutDialog } from "./checkout-dialog";
import { QrScanner } from "./qr-scanner";
import { ManualEntry, type ManualEntryHandle } from "./manual-entry";
import { ResultBanner } from "./scan-result";

export const SCAN_ERRORS = [
  CrewErrorCode.CardInvalid,
  CrewErrorCode.CardExpired,
  CrewErrorCode.StudentNotFound,
  CrewErrorCode.NotOnThisTrip,
  CrewErrorCode.AlreadyBoarded,
  CrewErrorCode.NotOnBoard,
  CrewErrorCode.ReasonRequired,
  CrewErrorCode.TripNotStarted,
  CrewErrorCode.TripAlreadyEnded,
] as const;

/** One pass waiting to be sent: from the camera, or typed. */
interface PendingScan {
  method: ScanMethod;
  value: string;
}

export type LastResult =
  { ok: true; action: ScanAction; rider: Rider } | { ok: false; message: string } | null;

export function Scanner({ trip, onScanned }: { trip: CrewTrip; onScanned: () => void }) {
  const t = useTranslations("crew.scan");
  const locale = useLocale() as Locale;
  const [action, setAction] = useState<ScanAction>(ScanAction.Board);
  const [pending, setPending] = useState<PendingScan | null>(null);
  const manualRef = useRef<ManualEntryHandle>(null);
  const [result, setResult] = useState<LastResult>(null);
  const [counts, setCounts] = useState<RiderCounts>(trip.counts);
  const { submit, isSending, serverError, clearServerError } = useSubmit(SCAN_ERRORS);

  async function send(scan: PendingScan, reason: CheckoutReason | null, note: string | null) {
    const done = await submit((idempotencyKey) =>
      scanRider(
        trip.trip_id,
        {
          action,
          method: scan.method,
          qr_token: scan.method === ScanMethod.Qr ? scan.value : null,
          identifier: scan.method === ScanMethod.Manual ? scan.value : null,
          reason,
          note,
        },
        { idempotencyKey },
      ),
    );
    // The driver types one ID after another: keep the box ready for the next.
    if (scan.method === ScanMethod.Manual) manualRef.current?.focus();
    if (done) {
      setResult({ ok: true, action, rider: done.rider });
      setCounts(done.counts);
      setPending(null);
      if (scan.method === ScanMethod.Manual) manualRef.current?.clear();
      navigator.vibrate?.(80);
      onScanned();
    }
    return done;
  }

  function received(scan: PendingScan) {
    clearServerError();
    setResult(null);
    if (action === ScanAction.Checkout) {
      setPending(scan);
      return;
    }
    setPending(scan);
    void send(scan, null, null).then((done) => {
      if (!done) setPending(null);
    });
  }

  const errorText = serverError ? t(`errors.${serverError}`) : null;
  const shownResult: LastResult =
    errorText && action === ScanAction.Board ? { ok: false, message: errorText } : result;
  const checkoutOpen = action === ScanAction.Checkout && pending !== null;

  return (
    <div className="grid items-start gap-5 desktop:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <Card elevation="raised">
        <CardBody className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <FilterChips
              label={t("modeLabel")}
              value={action}
              onChange={(value) => {
                setAction(value);
                setResult(null);
                clearServerError();
              }}
              options={[
                { value: ScanAction.Board, label: t("modeBoard") },
                { value: ScanAction.Checkout, label: t("modeCheckout") },
              ]}
            />
            <p className="text-body-sm text-ink-muted" aria-live="polite">
              {t("boardedCount", {
                boarded: formatNumber(counts.boarded, locale),
                total: formatNumber(counts.total, locale),
              })}
            </p>
          </div>
          <p className="text-body-sm text-ink">
            {action === ScanAction.Board ? t("boardHint") : t("checkoutHint")}
          </p>
          <QrScanner
            paused={isSending || pending !== null}
            onCode={(text) => received({ method: ScanMethod.Qr, value: text })}
          />
          <ResultBanner result={shownResult} />
        </CardBody>
      </Card>

      <ManualEntry
        ref={manualRef}
        action={action}
        isSending={isSending && pending?.method === ScanMethod.Manual && !checkoutOpen}
        onEntered={(value) => received({ method: ScanMethod.Manual, value })}
      />

      <CheckoutDialog
        open={checkoutOpen}
        riderName={null}
        isSending={isSending}
        error={errorText}
        onClose={() => {
          setPending(null);
          clearServerError();
        }}
        onConfirm={(reason, note) => {
          if (pending) void send(pending, reason, note);
        }}
      />
    </div>
  );
}
