"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Radio } from "@/components/ui/choice";
import { Dialog } from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import { SelectField, TextField } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tone } from "@/components/ui/tone";
import type { BusType } from "@/features/lines/schema";
import { SosType } from "@/features/sos/schema";
import type { Locale } from "@/i18n/routing";
import { formatNumber } from "@/lib/format";
import { AsyncStatus, useAsync } from "@/lib/hooks/use-async";
import { useSubmit } from "@/lib/hooks/use-submit";
import { getReplacementOptions, sendReplacement } from "../api";
import {
  EmergencyErrorCode,
  REPLACEMENT_REASONS,
  ReplacementReason,
  SOS_ACTION_NOTE_MAX_LENGTH,
  type ReplacementOptions,
  type TripReplacement,
} from "../schema";

const ERRORS = Object.values(EmergencyErrorCode);

const Kind = { Bus: "bus", Driver: "driver" } as const;
type Kind = (typeof Kind)[keyof typeof Kind];

const REASON_FOR_TYPE: Record<SosType, ReplacementReason> = {
  [SosType.Breakdown]: ReplacementReason.Breakdown,
  [SosType.Accident]: ReplacementReason.Accident,
  [SosType.Medical]: ReplacementReason.DriverUnavailable,
};

interface ReplacementDialogProps {
  open: boolean;
  tripId: string;
  sosId: string;
  sosType: SosType;
  onClose: () => void;
  onSent: (replacement: TripReplacement) => void;
}

/** Another bus (with its driver) or only another driver, sent to the trip from the alert. */
export function ReplacementDialog(props: ReplacementDialogProps) {
  const t = useTranslations("emergencies.replacementDialog");
  // Mounting the body only while open re-reads who is free each time it opens.
  return (
    <Dialog open={props.open} onClose={props.onClose} title={t("title")}>
      {props.open ? <ReplacementBody {...props} /> : null}
    </Dialog>
  );
}

function ReplacementBody({ tripId, sosId, sosType, onClose, onSent }: ReplacementDialogProps) {
  const options = useAsync((signal) => getReplacementOptions(tripId, { signal }), [tripId]);
  if (options.status === AsyncStatus.Loading) return <Skeleton className="h-64 w-full" />;
  if (options.status === AsyncStatus.Error) {
    return <ErrorState error={options.error} onRetry={options.reload} />;
  }
  return (
    <ReplacementForm
      options={options.data}
      sosId={sosId}
      defaultReason={REASON_FOR_TYPE[sosType]}
      onClose={onClose}
      onSent={onSent}
    />
  );
}

function ReplacementForm({
  options,
  sosId,
  defaultReason,
  onClose,
  onSent,
}: {
  options: ReplacementOptions;
  sosId: string;
  defaultReason: ReplacementReason;
  onClose: () => void;
  onSent: (replacement: TripReplacement) => void;
}) {
  const t = useTranslations("emergencies");
  const tRoot = useTranslations();
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;
  const [kind, setKind] = useState<Kind>(Kind.Bus);
  const [busId, setBusId] = useState(options.buses[0]?.bus_id ?? "");
  const [driverId, setDriverId] = useState(options.drivers[0]?.driver_id ?? "");
  const [reason, setReason] = useState<ReplacementReason>(defaultReason);
  const [note, setNote] = useState("");
  const { submit, isSending, serverError } = useSubmit(ERRORS);

  const bus = options.buses.find((item) => item.bus_id === busId);
  const picked = kind === Kind.Bus ? Boolean(bus) : Boolean(driverId);
  const busType = (type: BusType) => tRoot(`student.busType.${type}`);

  async function onSend() {
    const sent = await submit((idempotencyKey) =>
      sendReplacement(
        options.trip_id,
        {
          bus_id: kind === Kind.Bus ? busId : null,
          driver_id: kind === Kind.Driver ? driverId : null,
          reason,
          note: note.trim() || null,
          sos_id: sosId,
        },
        { idempotencyKey },
      ),
    );
    if (sent) onSent(sent);
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-body-sm text-ink">
        {t("replacementDialog.now", {
          code: options.line.code,
          plate: options.bus.plate,
          driver: options.driver.name,
          riders: formatNumber(options.riders, locale),
        })}
      </p>

      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-body-sm font-bold text-ink-strong">
          {t("replacementDialog.kind")}
        </legend>
        <Radio
          name="replacement-kind"
          label={t("replacementDialog.kindBus")}
          checked={kind === Kind.Bus}
          onChange={() => setKind(Kind.Bus)}
        />
        <Radio
          name="replacement-kind"
          label={t("replacementDialog.kindDriver")}
          checked={kind === Kind.Driver}
          onChange={() => setKind(Kind.Driver)}
        />
      </fieldset>

      {kind === Kind.Bus ? (
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-body-sm font-bold text-ink-strong">
            {t("replacementDialog.pickBus")}
          </legend>
          {options.buses.length === 0 ? (
            <Alert tone={Tone.Warning} title={t("replacementDialog.noBuses")} />
          ) : (
            options.buses.map((item) => (
              <Radio
                key={item.bus_id}
                name="replacement-bus"
                label={t("replacementDialog.busOption", {
                  plate: item.plate,
                  type: busType(item.bus_type),
                  seats: formatNumber(item.seats, locale),
                })}
                description={t("replacementDialog.busDriver", { name: item.driver.name })}
                checked={busId === item.bus_id}
                onChange={() => setBusId(item.bus_id)}
              />
            ))
          )}
          {bus && bus.seats < options.riders ? (
            <Alert
              tone={Tone.Warning}
              title={t("replacementDialog.seatsWarning", {
                seats: formatNumber(bus.seats, locale),
                riders: formatNumber(options.riders, locale),
              })}
            />
          ) : null}
        </fieldset>
      ) : (
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-body-sm font-bold text-ink-strong">
            {t("replacementDialog.pickDriver")}
          </legend>
          {options.drivers.length === 0 ? (
            <Alert tone={Tone.Warning} title={t("replacementDialog.noDrivers")} />
          ) : (
            options.drivers.map((item) => (
              <Radio
                key={item.driver_id}
                name="replacement-driver"
                label={item.name}
                checked={driverId === item.driver_id}
                onChange={() => setDriverId(item.driver_id)}
              />
            ))
          )}
        </fieldset>
      )}

      <SelectField
        label={t("replacementDialog.reason")}
        value={reason}
        options={REPLACEMENT_REASONS.map((value) => ({
          value,
          label: t(`replacementDialog.reasons.${value}`),
        }))}
        onChange={(event) => setReason(event.target.value as ReplacementReason)}
      />
      <TextField
        label={t("replacementDialog.note")}
        optionalText={tCommon("optional")}
        maxLength={SOS_ACTION_NOTE_MAX_LENGTH}
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
      <p className="text-caption text-ink-muted">{t("replacementDialog.whoIsTold")}</p>
      {serverError ? <Alert tone={Tone.Danger} title={t(`errors.${serverError}`)} /> : null}
      <div className="flex flex-col-reverse gap-2 desktop:flex-row desktop:justify-end">
        <Button variant="secondary" onClick={onClose} disabled={isSending}>
          {tCommon("cancel")}
        </Button>
        <Button onClick={() => void onSend()} isLoading={isSending} disabled={!picked}>
          {t("replacementDialog.confirm")}
        </Button>
      </div>
    </div>
  );
}
