"use client";

import { Ban } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { TextAreaField } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { Tone } from "@/components/ui/tone";
import { useSubmit } from "@/lib/hooks/use-submit";
import { cancelEvent } from "../api";
import {
  EVENT_NOTE_MAX_LENGTH,
  EVENT_REASON_MIN_LENGTH,
  EventErrorCode,
  EventStatus,
  type BusEvent,
} from "../schema";

const ERRORS = Object.values(EventErrorCode);

/** Call the request off, with a reason Abu El Hol reads. */
export function CancelEventCard({ event, onDone }: { event: BusEvent; onDone: () => void }) {
  const t = useTranslations("desk.events.cancel");
  const tErrors = useTranslations("desk.events.errors");
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const { submit, isSending, serverError, clearServerError } = useSubmit(ERRORS);

  async function confirm() {
    const text = reason.trim();
    if (text.length < EVENT_REASON_MIN_LENGTH) {
      setError(t("reasonRequired"));
      return;
    }
    const done = await submit((idempotencyKey) =>
      cancelEvent(event.event_id, { reason: text }, { idempotencyKey }),
    );
    if (!done) return;
    toast.show({ title: t("done"), tone: Tone.Success });
    setOpen(false);
    onDone();
  }

  return (
    <Card>
      <CardHeader title={t("title")} headingLevel={2} />
      <CardBody className="flex flex-col gap-4">
        <p className="text-body-sm text-ink">
          {event.status === EventStatus.Confirmed ? t("leadConfirmed") : t("lead")}
        </p>
        <div>
          <Button variant="secondary" iconStart={<Ban />} onClick={() => setOpen(true)}>
            {t("button")}
          </Button>
        </div>
      </CardBody>
      {open ? (
        <ConfirmDialog
          open
          onClose={() => {
            setOpen(false);
            setError(undefined);
            clearServerError();
          }}
          onConfirm={() => void confirm()}
          isConfirming={isSending}
          title={t("dialogTitle")}
          description={t("dialogBody")}
          confirmLabel={t("button")}
          cancelLabel={t("keep")}
          destructive
        >
          <div className="flex flex-col gap-4">
            <TextAreaField
              label={t("reason")}
              hint={t("reasonHint")}
              required
              rows={3}
              maxLength={EVENT_NOTE_MAX_LENGTH}
              value={reason}
              error={error}
              onChange={(change) => {
                setReason(change.target.value);
                setError(undefined);
              }}
            />
            {serverError ? <Alert tone={Tone.Danger} title={tErrors(serverError)} /> : null}
          </div>
        </ConfirmDialog>
      ) : null}
    </Card>
  );
}
