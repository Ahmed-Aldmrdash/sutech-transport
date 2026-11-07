"use client";

import { CircleAlert, CircleCheck, LogOut, ScanLine } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChips } from "@/components/ui/filter-chips";
import { TextField } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { formatNumber, toLatinDigits } from "@/lib/format";
import { useSubmit } from "@/lib/hooks/use-submit";
import { scanRider } from "../api";
import {
  CrewErrorCode,
  CrewTripStatus,
  ScanAction,
  ScanMethod,
  type CheckoutReason,
  type CrewToday,
  type CrewTrip,
  type Rider,
  type RiderCounts,
} from "../schema";
import { CheckoutDialog } from "./checkout-dialog";
import { CrewGate } from "./crew-gate";
import { QrScanner } from "./qr-scanner";

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

type LastResult =
  { ok: true; action: ScanAction; rider: Rider } | { ok: false; message: string } | null;

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

function Scanner({ trip, onScanned }: { trip: CrewTrip; onScanned: () => void }) {
  const t = useTranslations("crew.scan");
  const locale = useLocale() as Locale;
  const [action, setAction] = useState<ScanAction>(ScanAction.Board);
  const [pending, setPending] = useState<PendingScan | null>(null);
  const [identifier, setIdentifier] = useState("");
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
    if (done) {
      setResult({ ok: true, action, rider: done.rider });
      setCounts(done.counts);
      setPending(null);
      setIdentifier("");
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

  function onManual(event: FormEvent) {
    event.preventDefault();
    const typed = toLatinDigits(identifier).trim();
    if (typed) received({ method: ScanMethod.Manual, value: typed });
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

      <Card>
        <CardHeader title={t("manualTitle")} description={t("manualLead")} headingLevel={2} />
        <CardBody>
          <form noValidate onSubmit={onManual} className="flex flex-col gap-3">
            <TextField
              label={t("manualLabel")}
              inputMode="numeric"
              autoComplete="off"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
            />
            <Button
              type="submit"
              variant="secondary"
              className="self-start"
              isLoading={isSending && pending?.method === ScanMethod.Manual && !checkoutOpen}
              iconStart={
                action === ScanAction.Board ? (
                  <CircleCheck className="size-4" />
                ) : (
                  <LogOut className="size-4" />
                )
              }
            >
              {action === ScanAction.Board ? t("manualBoard") : t("manualCheckout")}
            </Button>
          </form>
        </CardBody>
      </Card>

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

/** The answer to the last scan, big enough to read at arm's length. */
function ResultBanner({ result }: { result: LastResult }) {
  const t = useTranslations("crew.scan");
  if (!result) return null;
  if (!result.ok) {
    return (
      <div
        role="alert"
        className="flex items-center gap-3 rounded-card bg-danger-soft p-4 text-danger"
      >
        <CircleAlert aria-hidden="true" className="size-7 shrink-0" />
        <p className="text-body font-bold">{result.message}</p>
      </div>
    );
  }
  const { rider } = result;
  const boarded = result.action === ScanAction.Board;
  return (
    <div
      role="status"
      className={cn(
        "flex items-center gap-3 rounded-card p-4",
        boarded ? "bg-success-soft text-success-text" : "bg-warning-soft text-warning-text",
      )}
    >
      {boarded ? (
        <CircleCheck aria-hidden="true" className="size-7 shrink-0" />
      ) : (
        <LogOut aria-hidden="true" className="size-7 shrink-0" />
      )}
      <div className="min-w-0">
        <p className="text-body font-bold">
          {boarded
            ? t("boardedResult", { name: rider.name })
            : t("checkedOutResult", { name: rider.name })}
        </p>
        <p className="text-body-sm">
          <bdi>{rider.identifier}</bdi> · {rider.stop_name}
        </p>
      </div>
    </div>
  );
}
