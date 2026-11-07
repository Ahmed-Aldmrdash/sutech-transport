"use client";

import {
  Ambulance,
  BusFront,
  CircleCheck,
  Hand,
  MapPin,
  MessageSquareText,
  Phone,
  Users,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, type ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { LiveDot } from "@/components/ui/badge";
import { BackLink } from "@/components/ui/back-link";
import { Button, buttonStyles } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import { TextAreaField } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { Tone } from "@/components/ui/tone";
import { EMERGENCY_CONTACTS } from "@/features/sos/contacts";
import { SosActionLog } from "@/features/sos/components/sos-action-log";
import { SosAction, SosStatus, SosType } from "@/features/sos/schema";
import { BusMap } from "@/features/tracking/components/bus-map";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { formatDateTime, formatNumber, formatPhone, formatTime } from "@/lib/format";
import { AsyncStatus, useAsync } from "@/lib/hooks/use-async";
import { useSubmit } from "@/lib/hooks/use-submit";
import { addSosAction, getAdminSos } from "../api";
import {
  EmergencyErrorCode,
  SOS_ACTION_NOTE_MAX_LENGTH,
  type AdminSos,
  type OfficeSosAction,
} from "../schema";
import { EMERGENCIES_REFRESH_MS } from "./emergencies-page";
import { ReplacementDialog } from "./replacement-dialog";
import { SosStatusBadge } from "./sos-status-badge";
import { useCanSendReplacement } from "./use-office-role";

const ERRORS = Object.values(EmergencyErrorCode);
/** Types where someone may be hurt, so "ambulance called" is offered. */
const AMBULANCE_TYPES: readonly SosType[] = [SosType.Medical, SosType.Accident];
const AMBULANCE_NUMBER =
  EMERGENCY_CONTACTS.find((item) => item.key === "ambulance")?.phone ?? "123";

/** One alert for the office: where the bus is, who to call, what was done, and what to do next. */
export function EmergencyDetailPage({ sosId }: { sosId: string }) {
  const t = useTranslations("emergencies");
  const state = useAsync((signal) => getAdminSos(sosId, { signal }), [sosId]);
  const { refresh } = state;
  const isClosed = state.status === AsyncStatus.Success && state.data.status === SosStatus.Closed;

  useEffect(() => {
    if (isClosed) return;
    const timer = window.setInterval(refresh, EMERGENCIES_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [refresh, isClosed]);

  const back = <BackLink href="/admin/emergencies">{t("back")}</BackLink>;
  if (state.status === AsyncStatus.Loading) {
    return (
      <div className="flex flex-col gap-6">
        {back}
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }
  if (state.status === AsyncStatus.Error) {
    return (
      <div className="flex flex-col gap-6">
        {back}
        <ErrorState error={state.error} onRetry={state.reload} />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      {back}
      <SosView sos={state.data} onChanged={refresh} />
    </div>
  );
}

function SosView({ sos, onChanged }: { sos: AdminSos; onChanged: () => void }) {
  const t = useTranslations("emergencies");
  const tRoot = useTranslations();
  const locale = useLocale() as Locale;

  return (
    <>
      <PageHeader
        eyebrow={`${tRoot(`emergencies.direction.${sos.direction}`)} · ${formatDateTime(sos.created_at, locale)}`}
        title={`${tRoot(`sos.types.${sos.type}.label`)} · ${t("lineName", { code: sos.line.code, name: sos.line.name })}`}
        actions={<SosStatusBadge status={sos.status} />}
      />
      <StatusBanner sos={sos} onChanged={onChanged} />
      <div className="grid items-start gap-5 desktop:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-5">
          <LocationCard sos={sos} />
          <Card>
            <CardHeader title={t("busTitle")} headingLevel={2} />
            <CardBody>
              <dl className="grid gap-4 sm:grid-cols-2">
                <Fact label={t("bus")} icon={<BusFront />}>
                  {t("busLine", {
                    plate: sos.bus.plate,
                    type: tRoot(`student.busType.${sos.bus.bus_type}`),
                    seats: formatNumber(sos.bus.seats, locale),
                  })}
                </Fact>
                <Fact label={t("ridersOnBoard")} icon={<Users />}>
                  {formatNumber(sos.riders_on_board, locale)}
                </Fact>
                <Fact label={t("driver")}>
                  <CallLink name={sos.driver.name} phone={sos.driver.phone} />
                </Fact>
                <Fact label={t("raisedByTitle")}>
                  <span className="block">
                    {t("raisedBy", {
                      role: tRoot(`roles.${sos.raised_by.role}`),
                      name: sos.raised_by.name,
                    })}
                  </span>
                  {sos.raised_by_phone && sos.raised_by_phone !== sos.driver.phone ? (
                    <CallLink name={sos.raised_by.name} phone={sos.raised_by_phone} />
                  ) : null}
                </Fact>
                {sos.note ? (
                  <Fact label={t("crewNote")} className="sm:col-span-2">
                    {sos.note}
                  </Fact>
                ) : null}
              </dl>
            </CardBody>
          </Card>
        </div>
        <div className="flex flex-col gap-5">
          {sos.status === SosStatus.Closed ? null : <ActionsCard sos={sos} onChanged={onChanged} />}
          <Card>
            <CardHeader title={tRoot("sos.log.title")} headingLevel={2} />
            <CardBody>
              <SosActionLog actions={sos.actions} />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

function Fact({
  label,
  icon,
  className,
  children,
}: {
  label: string;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 items-start gap-2", className)}>
      {icon ? (
        <span aria-hidden="true" className="mt-0.5 shrink-0 text-teal [&_svg]:size-5">
          {icon}
        </span>
      ) : null}
      <div className="min-w-0">
        <dt className="text-caption text-ink-muted">{label}</dt>
        <dd className="text-body-sm font-bold text-ink-strong">{children}</dd>
      </div>
    </div>
  );
}

function CallLink({ name, phone }: { name: string; phone: string }) {
  const t = useTranslations("emergencies");
  return (
    <a
      href={`tel:${phone}`}
      aria-label={t("call", { name })}
      className="inline-flex min-h-tap items-center gap-2 text-brand underline-offset-2 focus-ring hover:underline"
    >
      <Phone aria-hidden="true" className="size-4 shrink-0" />
      <span>
        {name} · <bdi dir="ltr">{formatPhone(phone)}</bdi>
      </span>
    </a>
  );
}

function LocationCard({ sos }: { sos: AdminSos }) {
  const t = useTranslations("emergencies");
  const locale = useLocale() as Locale;
  const { location } = sos;
  return (
    <Card elevation="raised">
      <CardHeader title={t("location")} headingLevel={2} />
      <CardBody className="flex flex-col gap-3">
        {location ? (
          <>
            <BusMap
              bus={{ lat: location.lat, lng: location.lng, heading: null }}
              trail={[]}
              campus={sos.campus_location}
              stop={null}
              className="h-72 desktop:h-[22rem]"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-caption text-ink-muted">
                {t("fromGps", { time: formatTime(location.fix_at, locale) })} ·{" "}
                <bdi dir="ltr">
                  {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                </bdi>
              </p>
              <a
                href={`https://www.google.com/maps?q=${location.lat},${location.lng}`}
                target="_blank"
                rel="noreferrer"
                className={buttonStyles({ variant: "secondary", size: "sm" })}
              >
                <MapPin aria-hidden="true" className="size-4" />
                {t("openInMaps")}
              </a>
            </div>
          </>
        ) : (
          <p className="text-body-sm text-ink-muted">{t("noLocation")}</p>
        )}
      </CardBody>
    </Card>
  );
}

/** Not taken: a loud banner with "Take it". Taken or closed: who and when. */
function StatusBanner({ sos, onChanged }: { sos: AdminSos; onChanged: () => void }) {
  const t = useTranslations("emergencies");
  const locale = useLocale() as Locale;
  const { submit, isSending, serverError } = useSubmit(ERRORS);
  const entryOf = (action: SosAction) => sos.actions.find((entry) => entry.action === action);

  if (sos.status === SosStatus.Open) {
    return (
      <div
        role="alert"
        className="flex flex-col gap-3 rounded-card bg-danger-soft p-4 text-danger sm:flex-row sm:items-center"
      >
        <p className="flex flex-1 items-center gap-3 text-body font-bold">
          <LiveDot className="bg-danger" />
          {t("openBanner")}
        </p>
        {serverError ? <p className="text-body-sm">{t(`errors.${serverError}`)}</p> : null}
        <Button
          variant="danger"
          size="lg"
          isLoading={isSending}
          iconStart={<Hand className="size-5" />}
          onClick={() =>
            void submit((idempotencyKey) =>
              addSosAction(
                sos.id,
                { action: SosAction.Acknowledge, note: null },
                { idempotencyKey },
              ),
            ).then(onChanged)
          }
        >
          {t("take")}
        </Button>
      </div>
    );
  }
  const closed = entryOf(SosAction.Close);
  const taken = entryOf(SosAction.Acknowledge);
  const entry = closed ?? taken;
  return (
    <div
      role="status"
      className={cn(
        "flex items-center gap-3 rounded-card p-4 text-body font-bold",
        closed ? "bg-success-soft text-success-text" : "bg-warning-soft text-warning-text",
      )}
    >
      <CircleCheck aria-hidden="true" className="size-6 shrink-0" />
      {entry
        ? t(closed ? "closedBy" : "takenBy", {
            name: entry.by_name ?? "",
            time: formatTime(entry.at, locale),
          })
        : null}
    </div>
  );
}

type Pending = { action: OfficeSosAction } | { action: "replacement" } | null;

function ActionsCard({ sos, onChanged }: { sos: AdminSos; onChanged: () => void }) {
  const t = useTranslations("emergencies");
  const toast = useToast();
  const canReplace = useCanSendReplacement();
  const [pending, setPending] = useState<Pending>(null);
  const [note, setNote] = useState("");
  const { submit, isSending, serverError, clearServerError } = useSubmit(ERRORS);
  const isTaken = sos.status === SosStatus.Acknowledged;
  const ambulanceLogged = sos.actions.some((entry) => entry.action === SosAction.AmbulanceCalled);

  function open(next: Pending) {
    clearServerError();
    setNote("");
    setPending(next);
  }

  async function log(action: OfficeSosAction) {
    const done = await submit((idempotencyKey) =>
      addSosAction(sos.id, { action, note: note.trim() || null }, { idempotencyKey }),
    );
    if (done) {
      setPending(null);
      toast.show({ title: t("logged"), tone: Tone.Success });
      onChanged();
    }
  }

  const action = pending && pending.action !== "replacement" ? pending.action : null;
  const errorText = serverError ? t(`errors.${serverError}`) : null;

  return (
    <Card elevation="raised">
      <CardHeader title={t("actionsTitle")} headingLevel={2} />
      <CardBody className="flex flex-col gap-3">
        {isTaken ? null : <p className="text-body-sm text-ink-muted">{t("takeFirst")}</p>}
        {AMBULANCE_TYPES.includes(sos.type) && !ambulanceLogged ? (
          <Button
            variant="secondary"
            disabled={!isTaken}
            iconStart={<Ambulance className="size-5" />}
            onClick={() => open({ action: SosAction.AmbulanceCalled })}
          >
            {t("ambulance")}
          </Button>
        ) : null}
        {canReplace ? (
          <Button
            variant="secondary"
            disabled={!isTaken}
            iconStart={<BusFront className="size-5" />}
            onClick={() => open({ action: "replacement" })}
          >
            {t("replacement")}
          </Button>
        ) : (
          <p className="text-caption text-ink-muted">{t("clinicNote")}</p>
        )}
        <Button
          variant="secondary"
          disabled={!isTaken}
          iconStart={<MessageSquareText className="size-5" />}
          onClick={() => open({ action: SosAction.Note })}
        >
          {t("addNote")}
        </Button>
        <Button
          disabled={!isTaken}
          iconStart={<CircleCheck className="size-5" />}
          onClick={() => open({ action: SosAction.Close })}
        >
          {t("close")}
        </Button>
      </CardBody>

      <ConfirmDialog
        open={action === SosAction.AmbulanceCalled}
        onClose={() => setPending(null)}
        onConfirm={() => void log(SosAction.AmbulanceCalled)}
        isConfirming={isSending}
        title={t("ambulanceTitle")}
        description={t("ambulanceBody", { number: AMBULANCE_NUMBER })}
        confirmLabel={t("ambulance")}
      >
        {errorText ? <Alert tone={Tone.Danger} title={errorText} /> : null}
      </ConfirmDialog>
      <ConfirmDialog
        open={action === SosAction.Note || action === SosAction.Close}
        onClose={() => setPending(null)}
        onConfirm={() => {
          if (action) void log(action);
        }}
        isConfirming={isSending}
        title={action === SosAction.Close ? t("closeTitle") : t("noteTitle")}
        description={action === SosAction.Close ? t("closeBody") : undefined}
        confirmLabel={action === SosAction.Close ? t("close") : t("addNote")}
      >
        <div className="flex flex-col gap-3">
          <TextAreaField
            label={action === SosAction.Close ? t("summaryLabel") : t("noteLabel")}
            required
            maxLength={SOS_ACTION_NOTE_MAX_LENGTH}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          {errorText ? <Alert tone={Tone.Danger} title={errorText} /> : null}
        </div>
      </ConfirmDialog>
      {canReplace ? (
        <ReplacementDialog
          open={pending?.action === "replacement"}
          tripId={sos.trip_id}
          sosId={sos.id}
          sosType={sos.type}
          onClose={() => setPending(null)}
          onSent={(sent) => {
            setPending(null);
            toast.show({
              title: t("replacementDialog.sent", { plate: sent.bus.plate, name: sent.driver.name }),
              tone: Tone.Success,
            });
            onChanged();
          }}
        />
      ) : null}
    </Card>
  );
}
