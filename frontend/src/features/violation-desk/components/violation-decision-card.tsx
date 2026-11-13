"use client";

import { FolderOpen, Gavel } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Radio } from "@/components/ui/choice";
import { ConfirmDialog } from "@/components/ui/dialog";
import { TextAreaField } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { Tone } from "@/components/ui/tone";
import { VIOLATION_OUTCOMES, type ViolationOutcome } from "@/features/violations/schema";
import { focusFirstError } from "@/lib/forms/focus-first-error";
import { useSubmit } from "@/lib/hooks/use-submit";
import { actOnViolation } from "../api";
import {
  VIOLATION_NOTE_MAX_LENGTH,
  VIOLATION_NOTE_MIN_LENGTH,
  ViolationDeskAction,
  ViolationDeskErrorCode,
  type DeskViolation,
} from "../schema";

const ERRORS = Object.values(ViolationDeskErrorCode);

/** Student Affairs: take the report, then close it with an outcome and a note for the file. */
export function ViolationDecisionCard({
  item,
  onDone,
}: {
  item: DeskViolation;
  onDone: () => void;
}) {
  const t = useTranslations("desk.violations.act");
  const tOutcomes = useTranslations("desk.violations.outcomes");
  const tErrors = useTranslations("desk.violations.errors");
  const toast = useToast();
  const [action, setAction] = useState<ViolationDeskAction | null>(null);
  const [outcome, setOutcome] = useState<ViolationOutcome | null>(null);
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<{ outcome?: string; note?: string }>({});
  const boxRef = useRef<HTMLDivElement>(null);
  const { submit, isSending, serverError, clearServerError } = useSubmit(ERRORS);
  const isClose = action === ViolationDeskAction.Close;

  async function confirm() {
    if (!action) return;
    const text = note.trim();
    if (isClose) {
      const next: typeof errors = {};
      if (!outcome) next.outcome = t("outcomeRequired");
      if (text.length < VIOLATION_NOTE_MIN_LENGTH) next.note = t("noteRequired");
      setErrors(next);
      if (Object.keys(next).length > 0) {
        focusFirstError(boxRef.current);
        return;
      }
    }
    const done = await submit(() =>
      actOnViolation(item.violation_id, {
        action,
        outcome: isClose ? outcome : null,
        note: isClose ? text : null,
      }),
    );
    if (!done) return;
    toast.show({ title: t(isClose ? "closed" : "opened"), tone: Tone.Success });
    setAction(null);
    onDone();
  }

  return (
    <Card elevation="raised" className="border-brand">
      <CardHeader title={t("title")} headingLevel={2} />
      <CardBody className="flex flex-col gap-4">
        <p className="text-body-sm text-ink">{t("lead")}</p>
        <div className="flex flex-wrap gap-3">
          {item.allowed_actions.includes(ViolationDeskAction.Open) ? (
            <Button
              variant="secondary"
              iconStart={<FolderOpen />}
              onClick={() => setAction(ViolationDeskAction.Open)}
            >
              {t("open")}
            </Button>
          ) : null}
          {item.allowed_actions.includes(ViolationDeskAction.Close) ? (
            <Button iconStart={<Gavel />} onClick={() => setAction(ViolationDeskAction.Close)}>
              {t("close")}
            </Button>
          ) : null}
        </div>
      </CardBody>
      {action ? (
        <ConfirmDialog
          open
          onClose={() => {
            setAction(null);
            setErrors({});
            clearServerError();
          }}
          onConfirm={() => void confirm()}
          isConfirming={isSending}
          title={t(isClose ? "closeTitle" : "openTitle")}
          description={t(isClose ? "closeBody" : "openBody")}
          confirmLabel={t(isClose ? "close" : "open")}
        >
          <div ref={boxRef} className="flex flex-col gap-4">
            {isClose ? (
              <>
                <fieldset className="flex flex-col gap-1">
                  <legend className="mb-1 text-label text-ink-strong">{t("outcome")}</legend>
                  {VIOLATION_OUTCOMES.map((value) => (
                    <Radio
                      key={value}
                      name="violation-outcome"
                      value={value}
                      checked={outcome === value}
                      onChange={() => {
                        setOutcome(value);
                        setErrors((current) => ({ ...current, outcome: undefined }));
                      }}
                      label={tOutcomes(`${value}.label`)}
                      description={tOutcomes(`${value}.hint`)}
                      aria-invalid={errors.outcome ? true : undefined}
                    />
                  ))}
                  {errors.outcome ? (
                    <p className="text-caption text-danger-text" role="alert">
                      {errors.outcome}
                    </p>
                  ) : null}
                </fieldset>
                <TextAreaField
                  label={t("note")}
                  hint={t("noteHint")}
                  required
                  rows={4}
                  maxLength={VIOLATION_NOTE_MAX_LENGTH}
                  value={note}
                  error={errors.note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </>
            ) : null}
            {serverError ? <Alert tone={Tone.Danger} title={tErrors(serverError)} /> : null}
          </div>
        </ConfirmDialog>
      ) : null}
    </Card>
  );
}
