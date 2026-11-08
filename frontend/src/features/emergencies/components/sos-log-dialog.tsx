"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/ui/dialog";
import { TextAreaField } from "@/components/ui/input";
import { Tone } from "@/components/ui/tone";
import { EMERGENCY_CONTACTS } from "@/features/sos/contacts";
import { SosAction } from "@/features/sos/schema";
import { focusFirstError } from "@/lib/forms/focus-first-error";
import { useSubmit } from "@/lib/hooks/use-submit";
import { addSosAction } from "../api";
import { EmergencyErrorCode, SOS_ACTION_NOTE_MAX_LENGTH, type OfficeSosAction } from "../schema";

const ERRORS = Object.values(EmergencyErrorCode);

const AMBULANCE_NUMBER =
  EMERGENCY_CONTACTS.find((item) => item.key === "ambulance")?.phone ?? "123";

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
export function LogDialog({ sosId, action, onClose, onLogged }: LogDialogProps) {
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
