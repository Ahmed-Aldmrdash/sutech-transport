"use client";

import { MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { TextField } from "@/components/ui/input";
import { Tone } from "@/components/ui/tone";
import { type CrewTrip } from "@/features/crew/schema";
import { useSubmit } from "@/lib/hooks/use-submit";
import { createSos } from "../api";
import { SOS_TYPE_ICON } from "./sos-type";
import { SOS_NOTE_MAX_LENGTH, SOS_TYPES, SosErrorCode, type SosType, type Sos } from "../schema";

const SOS_ERRORS = [SosErrorCode.NotYourTrip, SosErrorCode.TripAlreadyEnded] as const;

export function SosPicker({ trip, onSent }: { trip: CrewTrip; onSent: (sos: Sos) => void }) {
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
