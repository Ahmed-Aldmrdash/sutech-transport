"use client";

import { Ambulance, BusFront, CircleCheck, MessageSquareText } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { TextAreaField } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { Tone } from "@/components/ui/tone";
import { EMERGENCY_CONTACTS } from "@/features/sos/contacts";
import { SosAction, SosStatus, SosType } from "@/features/sos/schema";
import { focusFirstError } from "@/lib/forms/focus-first-error";
import { useSubmit } from "@/lib/hooks/use-submit";
import { addSosAction } from "../api";
import {
  EmergencyErrorCode,
  SOS_ACTION_NOTE_MAX_LENGTH,
  type AdminSos,
  type OfficeSosAction,
} from "../schema";
import { ReplacementDialog } from "./replacement-dialog";
import { useCanSendReplacement } from "./use-office-role";

const ERRORS = Object.values(EmergencyErrorCode);
/** Types where someone may be hurt, so "ambulance called" is offered. */
const AMBULANCE_TYPES: readonly SosType[] = [SosType.Medical, SosType.Accident];
const AMBULANCE_NUMBER =
  EMERGENCY_CONTACTS.find((item) => item.key === "ambulance")?.phone ?? "123";

type Pending = { action: OfficeSosAction } | { action: "replacement" } | null;

/** The office's next steps on a taken alert: ambulance, another bus, a note, closing it. */
export function SosActionsCard({ sos, onChanged }: { sos: AdminSos; onChanged: () => void }) {
  const t = useTranslations("emergencies");
  const toast = useToast();
  const canReplace = useCanSendReplacement();
  const [pending, setPending] = useState<Pending>(null);
  const isTaken = sos.status === SosStatus.Acknowledged;
  const ambulanceLogged = sos.actions.some((entry) => entry.action === SosAction.AmbulanceCalled);
  const action = pending && pending.action !== "replacement" ? pending.action : null;

  function logged() {
    setPending(null);
    toast.show({ title: t("logged"), tone: Tone.Success });
    onChanged();
  }

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
            onClick={() => setPending({ action: SosAction.AmbulanceCalled })}
          >
            {t("ambulance")}
          </Button>
        ) : null}
        {canReplace ? (
          <Button
            variant="secondary"
            disabled={!isTaken}
            iconStart={<BusFront className="size-5" />}
            onClick={() => setPending({ action: "replacement" })}
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
          onClick={() => setPending({ action: SosAction.Note })}
        >
          {t("addNote")}
        </Button>
        <Button
          disabled={!isTaken}
          iconStart={<CircleCheck className="size-5" />}
          onClick={() => setPending({ action: SosAction.Close })}
        >
          {t("close")}
        </Button>
      </CardBody>

      {action ? (
        <LogDialog
          key={action}
          sosId={sos.id}
          action={action}
          onClose={() => setPending(null)}
          onLogged={logged}
        />
      ) : null}
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

interface LogDialogProps {
  sosId: string;
  action: OfficeSosAction;
  onClose: () => void;
  onLogged: () => void;
}

/**
 * Confirms one step for the log. A note and a closing summary must say something: an empty
 * box gets a message under it (the dialog's button is not a form submit, so the browser's own
 * `required` check never runs).
 */
function LogDialog({ sosId, action, onClose, onLogged }: LogDialogProps) {
  const t = useTranslations("emergencies");
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const { submit, isSending, serverError } = useSubmit(ERRORS);
  const needsText = action === SosAction.Note || action === SosAction.Close;
  const isClose = action === SosAction.Close;
  const errorText = serverError ? t(`errors.${serverError}`) : null;

  async function confirm() {
    const text = note.trim();
    if (needsText && text === "") {
      setNoteError(isClose ? t("summaryRequired") : t("noteRequired"));
      focusFirstError(fieldRef.current);
      return;
    }
    const done = await submit((idempotencyKey) =>
      addSosAction(sosId, { action, note: text || null }, { idempotencyKey }),
    );
    if (done) onLogged();
  }

  if (action === SosAction.AmbulanceCalled) {
    return (
      <ConfirmDialog
        open
        onClose={onClose}
        onConfirm={() => void confirm()}
        isConfirming={isSending}
        title={t("ambulanceTitle")}
        description={t("ambulanceBody", { number: AMBULANCE_NUMBER })}
        confirmLabel={t("ambulance")}
      >
        {errorText ? <Alert tone={Tone.Danger} title={errorText} /> : null}
      </ConfirmDialog>
    );
  }
  return (
    <ConfirmDialog
      open
      onClose={onClose}
      onConfirm={() => void confirm()}
      isConfirming={isSending}
      title={isClose ? t("closeTitle") : t("noteTitle")}
      description={isClose ? t("closeBody") : undefined}
      confirmLabel={isClose ? t("close") : t("addNote")}
    >
      <div ref={fieldRef} className="flex flex-col gap-3">
        <TextAreaField
          label={isClose ? t("summaryLabel") : t("noteLabel")}
          required
          maxLength={SOS_ACTION_NOTE_MAX_LENGTH}
          value={note}
          error={noteError ?? undefined}
          onChange={(event) => {
            setNote(event.target.value);
            setNoteError(null);
          }}
        />
        {errorText ? <Alert tone={Tone.Danger} title={errorText} /> : null}
      </div>
    </ConfirmDialog>
  );
}
