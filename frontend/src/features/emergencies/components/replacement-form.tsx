"use client";

import { BusChoice, DriverChoice } from "./replacement-choices";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Radio } from "@/components/ui/choice";
import { TextField } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { Tone } from "@/components/ui/tone";
import type { Locale } from "@/i18n/routing";
import { formatNumber } from "@/lib/format";
import { useSubmit } from "@/lib/hooks/use-submit";
import { sendReplacement } from "../api";
import {
  EmergencyErrorCode,
  REPLACEMENT_REASONS,
  type ReplacementReason,
  SOS_ACTION_NOTE_MAX_LENGTH,
  type ReplacementOptions,
  type TripReplacement,
} from "../schema";
import { Kind } from "./replacement-dialog";

const ERRORS = Object.values(EmergencyErrorCode);

export function ReplacementForm({
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
        <BusChoice options={options} value={busId} onChange={setBusId} />
      ) : (
        <DriverChoice options={options} value={driverId} onChange={setDriverId} />
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
