"use client";

import { Ambulance, CircleCheck, MapPin, Phone, Siren } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { LiveDot } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import { TextField } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Tone } from "@/components/ui/tone";
import { CrewGate } from "@/features/crew/components/crew-gate";
import { CrewTripStatus, type CrewToday, type CrewTrip } from "@/features/crew/schema";
import { currentTrip } from "@/features/crew/trip-rules";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { formatNumber, formatPhone, formatTime } from "@/lib/format";
import { AsyncStatus, useAsync } from "@/lib/hooks/use-async";
import { useSubmit } from "@/lib/hooks/use-submit";
import { createSos, getSos } from "../api";
import { EMERGENCY_CONTACTS } from "../contacts";
import { SosActionLog } from "./sos-action-log";
import { SOS_TYPE_ICON } from "./sos-type";
import {
  SOS_NOTE_MAX_LENGTH,
  SOS_TYPES,
  SosAction,
  SosErrorCode,
  SosStatus,
  type SosType,
  type Sos,
} from "../schema";

/** How often an open SOS is re-read until the WebSocket is in place. */
const SOS_REFRESH_MS = 5000;
const SOS_ERRORS = [SosErrorCode.NotYourTrip, SosErrorCode.TripAlreadyEnded] as const;

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

function SosPicker({ trip, onSent }: { trip: CrewTrip; onSent: (sos: Sos) => void }) {
  const t = useTranslations("sos");
  const tCommon = useTranslations("common");
  const [type, setType] = useState<SosType | null>(null);
  const [note, setNote] = useState("");
  const { submit, isSending, serverError } = useSubmit(SOS_ERRORS);

  async function send() {
    if (!type) return;
    const sos = await submit((idempotencyKey) =>
      createSos({ trip_id: trip.trip_id, type, note: note.trim() || null }, { idempotencyKey }),
    );
    if (sos) {
      setType(null);
      navigator.vibrate?.([120, 60, 120]);
      onSent(sos);
    }
  }

  return (
    <Card elevation="raised">
      <CardHeader title={t("pickTitle")} description={t("pickLead")} headingLevel={2} />
      <CardBody className="flex flex-col gap-3">
        {SOS_TYPES.map((value) => {
          const Icon = SOS_TYPE_ICON[value];
          return (
            <button
              key={value}
              type="button"
              onClick={() => setType(value)}
              className="flex min-h-20 items-center gap-4 rounded-card border-2 border-danger bg-danger-soft p-4 text-start text-danger-text focus-ring transition-colors hover:bg-danger hover:text-on-danger"
            >
              <Icon aria-hidden="true" className="size-8 shrink-0" />
              <span className="min-w-0">
                <span className="block text-h3">{t(`types.${value}.label`)}</span>
                <span className="block text-body-sm">{t(`types.${value}.hint`)}</span>
              </span>
            </button>
          );
        })}
        <p className="flex items-center gap-2 text-caption text-ink-muted">
          <MapPin aria-hidden="true" className="size-4 shrink-0" />
          {t("gpsNote")}
        </p>
      </CardBody>
      <ConfirmDialog
        open={type !== null}
        onClose={() => setType(null)}
        onConfirm={() => void send()}
        isConfirming={isSending}
        destructive
        title={type ? t("confirmTitle", { type: t(`types.${type}.label`) }) : ""}
        description={t("confirmBody")}
        confirmLabel={t("confirm")}
      >
        <div className="flex flex-col gap-3">
          <TextField
            label={t("note")}
            hint={t("noteHint")}
            optionalText={tCommon("optional")}
            maxLength={SOS_NOTE_MAX_LENGTH}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          {serverError ? <Alert tone={Tone.Danger} title={t(`errors.${serverError}`)} /> : null}
        </div>
      </ConfirmDialog>
    </Card>
  );
}

/** The alert after it was sent: who took it, and what the office did. */
function SosFollow({ sosId }: { sosId: string }) {
  const t = useTranslations("sos");
  const locale = useLocale() as Locale;
  const state = useAsync((signal) => getSos(sosId, { signal }), [sosId]);
  const { refresh } = state;
  const isClosed = state.status === AsyncStatus.Success && state.data.status === SosStatus.Closed;

  useEffect(() => {
    if (isClosed) return;
    const timer = setInterval(refresh, SOS_REFRESH_MS);
    return () => clearInterval(timer);
  }, [refresh, isClosed]);

  if (state.status === AsyncStatus.Loading) return <Skeleton className="h-72 w-full" />;
  if (state.status === AsyncStatus.Error) {
    return <ErrorState error={state.error} onRetry={state.reload} />;
  }
  const sos = state.data;
  const Icon = SOS_TYPE_ICON[sos.type];
  const taken = sos.actions.find((entry) => entry.action === SosAction.Acknowledge);

  return (
    <Card elevation="raised">
      <CardBody className="flex flex-col gap-4">
        <div className="flex items-center gap-3 text-danger-text">
          <Siren aria-hidden="true" className="size-8 shrink-0" />
          <div className="min-w-0">
            <p className="text-h3">{t("sentTitle", { type: t(`types.${sos.type}.label`) })}</p>
            <p className="text-body-sm text-ink-muted">
              {t("sentAt", { time: formatTime(sos.created_at, locale) })}
            </p>
          </div>
        </div>

        <div
          role="status"
          aria-live="polite"
          className={cn(
            "flex items-center gap-3 rounded-card p-4 text-body font-bold",
            sos.status === SosStatus.Open
              ? "bg-warning-soft text-warning-text"
              : "bg-success-soft text-success-text",
          )}
        >
          {sos.status === SosStatus.Open ? (
            <LiveDot className="bg-warning" />
          ) : (
            <CircleCheck aria-hidden="true" className="size-6 shrink-0" />
          )}
          <span>
            {sos.status === SosStatus.Open ? t("statusOpen") : null}
            {sos.status === SosStatus.Acknowledged
              ? t("statusAcknowledged", {
                  name: taken?.by_name ?? "",
                  time: taken ? formatTime(taken.at, locale) : "",
                })
              : null}
            {sos.status === SosStatus.Closed ? t("statusClosed") : null}
          </span>
        </div>

        <dl className="grid gap-3 text-body-sm sm:grid-cols-2">
          <div className="flex items-start gap-2">
            <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-teal" />
            <div>
              <dt className="text-caption text-ink-muted">{t("type")}</dt>
              <dd className="font-bold text-ink-strong">{t(`types.${sos.type}.label`)}</dd>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <MapPin aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-teal" />
            <div>
              <dt className="text-caption text-ink-muted">{t("location")}</dt>
              <dd className="font-bold text-ink-strong">
                {sos.location ? (
                  <a
                    href={`https://www.google.com/maps?q=${sos.location.lat},${sos.location.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2 focus-ring"
                  >
                    <bdi dir="ltr">
                      {sos.location.lat.toFixed(5)}, {sos.location.lng.toFixed(5)}
                    </bdi>
                  </a>
                ) : (
                  t("noLocation")
                )}
              </dd>
              {sos.location ? (
                <dd className="text-caption text-ink-muted">
                  {t("fromGps", { time: formatTime(sos.location.fix_at, locale) })}
                </dd>
              ) : null}
            </div>
          </div>
          <div>
            <dt className="text-caption text-ink-muted">{t("onBoard")}</dt>
            <dd className="font-bold text-ink-strong">
              {formatNumber(sos.riders_on_board, locale)}
            </dd>
          </div>
          {sos.note ? (
            <div>
              <dt className="text-caption text-ink-muted">{t("note")}</dt>
              <dd className="text-ink-strong">{sos.note}</dd>
            </div>
          ) : null}
        </dl>
        <div className="flex flex-col gap-3 border-t border-line pt-4">
          <h3 className="text-body font-bold text-ink-strong">{t("log.title")}</h3>
          <SosActionLog actions={sos.actions} />
        </div>
        <p className="text-caption text-ink-muted">{t("whoKnows")}</p>
      </CardBody>
    </Card>
  );
}

function Contacts() {
  const t = useTranslations("sos.contacts");
  return (
    <Card>
      <CardHeader title={t("title")} headingLevel={2} />
      <CardBody className="flex flex-col gap-3">
        {EMERGENCY_CONTACTS.map((contact) => (
          <a
            key={contact.key}
            href={`tel:${contact.phone}`}
            aria-label={t("call", { name: t(contact.key) })}
            className={cn(
              buttonStyles({
                variant: contact.key === "ambulance" ? "danger" : "secondary",
                fullWidth: true,
              }),
              "justify-between",
            )}
          >
            <span className="inline-flex items-center gap-2">
              {contact.key === "ambulance" ? (
                <Ambulance aria-hidden="true" className="size-5" />
              ) : (
                <Phone aria-hidden="true" className="size-5" />
              )}
              {t(contact.key)}
            </span>
            <bdi dir="ltr">
              {contact.phone.length > 6 ? formatPhone(contact.phone) : contact.phone}
            </bdi>
          </a>
        ))}
      </CardBody>
    </Card>
  );
}
