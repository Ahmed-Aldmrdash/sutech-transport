"use client";

import { CircleCheck, CircleX } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { TextAreaField } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { Tone } from "@/components/ui/tone";
import type { Locale } from "@/i18n/routing";
import { formatNumber } from "@/lib/format";
import { useSubmit } from "@/lib/hooks/use-submit";
import { replyToRequest } from "../api";
import {
  CompanyDecision,
  EVENT_NOTE_MAX_LENGTH,
  EVENT_REASON_MIN_LENGTH,
  EventErrorCode,
  type BusEvent,
  type CompanyRequest,
} from "../schema";
import { BusPicker } from "./bus-picker";

const ERRORS = Object.values(EventErrorCode);
type Available = CompanyRequest["available_buses"];

/** Abu El Hol picks the buses it sends (each with its driver), or declines with a reason. */
export function CompanyReplyCard({
  event,
  available,
  onDone,
}: {
  event: BusEvent;
  available: Available;
  onDone: () => void;
}) {
  const t = useTranslations("desk.company.reply");
  const tAll = useTranslations();
  const tErrors = useTranslations("desk.events.errors");
  const locale = useLocale() as Locale;
  const toast = useToast();
  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [pickError, setPickError] = useState<string>();
  const [declining, setDeclining] = useState(false);
  const [reasonError, setReasonError] = useState<string>();
  const { submit, isSending, serverError, clearServerError } = useSubmit(ERRORS);
  const max = event.buses_requested;

  function toggle(busId: string, checked: boolean) {
    setPickError(undefined);
    setPicked((current) =>
      checked ? [...current, busId] : current.filter((item) => item !== busId),
    );
  }

  async function send(decision: CompanyDecision) {
    const text = note.trim();
    if (decision === CompanyDecision.Confirm && picked.length === 0) {
      setPickError(t("pickRequired"));
      return;
    }
    if (decision === CompanyDecision.Decline && text.length < EVENT_REASON_MIN_LENGTH) {
      setReasonError(t("reasonRequired"));
      return;
    }
    const done = await submit((idempotencyKey) =>
      replyToRequest(
        event.event_id,
        {
          decision,
          bus_ids: decision === CompanyDecision.Confirm ? picked : [],
          note: text || null,
        },
        { idempotencyKey },
      ),
    );
    if (!done) return;
    toast.show({
      title: decision === CompanyDecision.Confirm ? t("confirmed") : t("declined"),
      tone: Tone.Success,
    });
    setDeclining(false);
    onDone();
  }

  return (
    <Card elevation="raised" className="border-brand">
      <CardHeader title={t("title")} headingLevel={2} />
      <CardBody className="flex flex-col gap-4">
        <p className="text-body-sm text-ink">
          {t("lead", {
            count: formatNumber(max, locale),
            type: tAll(`student.busType.${event.bus_type}`),
            students: formatNumber(event.students_count, locale),
          })}
        </p>
        <BusPicker
          available={available}
          picked={picked}
          max={max}
          error={pickError}
          onToggle={toggle}
        />
        {picked.length > 0 && picked.length < max ? (
          <Alert tone={Tone.Warning} title={t("partial")} />
        ) : null}
        <TextAreaField
          label={t("note")}
          hint={t("noteHint")}
          optionalText={tAll("common.optional")}
          rows={3}
          maxLength={EVENT_NOTE_MAX_LENGTH}
          value={note}
          onChange={(change) => setNote(change.target.value)}
        />
        {serverError && !declining ? (
          <Alert tone={Tone.Danger} title={tErrors(serverError)} />
        ) : null}
        <div className="flex flex-wrap gap-3">
          <Button
            iconStart={<CircleCheck />}
            isLoading={isSending && !declining}
            onClick={() => void send(CompanyDecision.Confirm)}
          >
            {t("confirm")}
          </Button>
          <Button
            variant="secondary"
            iconStart={<CircleX />}
            onClick={() => {
              clearServerError();
              setDeclining(true);
            }}
          >
            {t("decline")}
          </Button>
        </div>
      </CardBody>
      {declining ? (
        <ConfirmDialog
          open
          onClose={() => {
            setDeclining(false);
            setReasonError(undefined);
            clearServerError();
          }}
          onConfirm={() => void send(CompanyDecision.Decline)}
          isConfirming={isSending}
          title={t("declineTitle")}
          description={t("declineBody")}
          confirmLabel={t("decline")}
          destructive
        >
          <div className="flex flex-col gap-4">
            <TextAreaField
              label={t("reason")}
              required
              rows={3}
              maxLength={EVENT_NOTE_MAX_LENGTH}
              value={note}
              error={reasonError}
              onChange={(change) => {
                setNote(change.target.value);
                setReasonError(undefined);
              }}
            />
            {serverError ? <Alert tone={Tone.Danger} title={tErrors(serverError)} /> : null}
          </div>
        </ConfirmDialog>
      ) : null}
    </Card>
  );
}
