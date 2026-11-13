"use client";

import { Check, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { TextAreaField } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { Tone } from "@/components/ui/tone";
import { focusFirstError } from "@/lib/forms/focus-first-error";
import { useSubmit } from "@/lib/hooks/use-submit";
import { reviewPayment } from "../api";
import {
  FinanceErrorCode,
  REJECTION_REASON_MAX_LENGTH,
  REJECTION_REASON_MIN_LENGTH,
  ReviewDecision,
  type OfficePayment,
} from "../schema";

const ERRORS = Object.values(FinanceErrorCode);

/** Approve (the seat becomes active) or reject with a reason the student reads. */
export function ReviewCard({
  payment,
  onReviewed,
}: {
  payment: OfficePayment;
  onReviewed: () => void;
}) {
  const t = useTranslations("desk.payments.review");
  const tErrors = useTranslations("desk.payments.errors");
  const toast = useToast();
  const [decision, setDecision] = useState<ReviewDecision | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const { submit, isSending, serverError, clearServerError } = useSubmit(ERRORS);
  const isReject = decision === ReviewDecision.Reject;

  function close() {
    setDecision(null);
    setReasonError(null);
    clearServerError();
  }

  async function confirm() {
    if (!decision) return;
    const text = reason.trim();
    if (isReject && text.length < REJECTION_REASON_MIN_LENGTH) {
      setReasonError(t("reasonRequired"));
      focusFirstError(fieldRef.current);
      return;
    }
    const done = await submit(() =>
      reviewPayment(payment.payment_id, { decision, reason: isReject ? text : null }),
    );
    if (!done) return;
    toast.show({
      title: isReject ? t("rejectedToast") : t("approvedToast"),
      tone: isReject ? Tone.Info : Tone.Success,
    });
    setDecision(null);
    onReviewed();
  }

  return (
    <Card elevation="raised" className="border-brand">
      <CardHeader title={t("title")} headingLevel={2} />
      <CardBody className="flex flex-col gap-4">
        <p className="text-body-sm text-ink">{t("lead")}</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button iconStart={<Check />} onClick={() => setDecision(ReviewDecision.Approve)}>
            {t("approve")}
          </Button>
          <Button
            variant="secondary"
            iconStart={<X />}
            onClick={() => setDecision(ReviewDecision.Reject)}
          >
            {t("reject")}
          </Button>
        </div>
      </CardBody>
      {decision ? (
        <ConfirmDialog
          open
          onClose={close}
          onConfirm={() => void confirm()}
          isConfirming={isSending}
          destructive={isReject}
          title={isReject ? t("rejectTitle") : t("approveTitle")}
          description={
            isReject ? t("rejectBody") : t("approveBody", { name: payment.student.name })
          }
          confirmLabel={isReject ? t("reject") : t("approve")}
        >
          <div ref={fieldRef} className="flex flex-col gap-3">
            {isReject ? (
              <TextAreaField
                label={t("reasonLabel")}
                hint={t("reasonHint")}
                required
                maxLength={REJECTION_REASON_MAX_LENGTH}
                value={reason}
                error={reasonError ?? undefined}
                onChange={(event) => {
                  setReason(event.target.value);
                  setReasonError(null);
                }}
              />
            ) : null}
            {serverError ? <Alert tone={Tone.Danger} title={tErrors(serverError)} /> : null}
          </div>
        </ConfirmDialog>
      ) : null}
    </Card>
  );
}
