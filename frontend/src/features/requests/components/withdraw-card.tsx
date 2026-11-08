"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Tone } from "@/components/ui/tone";
import { useToast } from "@/components/ui/toast";
import { withdrawRequest } from "../api";
import { RequestErrorCode, type StudentRequest } from "../schema";
import { useSubmit } from "@/lib/hooks/use-submit";

export function WithdrawCard({
  request,
  onWithdrawn,
}: {
  request: StudentRequest;
  onWithdrawn: () => void;
}) {
  const t = useTranslations("student.requests.detail");
  const toast = useToast();
  const [isConfirming, setIsConfirming] = useState(false);
  const { submit, isSending, serverError } = useSubmit([RequestErrorCode.NotWithdrawable]);

  async function confirm() {
    const result = await submit((idempotencyKey) =>
      withdrawRequest(request.request_id, { idempotencyKey }),
    );
    setIsConfirming(false);
    if (result) {
      toast.show({ title: t("withdrawn"), tone: Tone.Success });
      onWithdrawn();
    }
  }

  return (
    <Card>
      <CardBody className="flex flex-col gap-3">
        <p className="text-body-sm text-ink">{t("withdrawHint")}</p>
        {serverError ? (
          <Alert tone={Tone.Danger} title={t(`withdrawErrors.${serverError}`)} />
        ) : null}
        <Button variant="secondary" className="self-start" onClick={() => setIsConfirming(true)}>
          {t("withdraw")}
        </Button>
      </CardBody>
      <ConfirmDialog
        open={isConfirming}
        onClose={() => setIsConfirming(false)}
        onConfirm={() => void confirm()}
        title={t("withdrawConfirmTitle")}
        description={t("withdrawConfirmBody", { reference: request.reference })}
        confirmLabel={t("withdrawConfirm")}
        cancelLabel={t("keep")}
        destructive
        isConfirming={isSending}
      />
    </Card>
  );
}
