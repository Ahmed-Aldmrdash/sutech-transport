"use client";

import { ApprovalDetails } from "./approval-details";
import { Check, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { TextAreaField } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { Tone } from "@/components/ui/tone";
import { firstNameOf } from "@/features/auth/user-text";
import type { Locale } from "@/i18n/routing";
import { formatDateTime } from "@/lib/format";
import { useSubmit } from "@/lib/hooks/use-submit";
import { approveAsGuardian, refuseAsGuardian } from "../api";
import {
  RequestActor,
  RequestErrorCode,
  RequestStatus,
  type GuardianApproval,
  type LineChangeRequest,
} from "../schema";
import { RequestStatusBadge } from "./request-status-badge";
import { Decision } from "./guardian-approvals-page";

const DECISION_ERRORS = [RequestErrorCode.NotAwaitingGuardian] as const;

const NOTE_MAX_LENGTH = 300;

export function ApprovalCard({
  item,
  onAnswered,
}: {
  item: GuardianApproval & { request: LineChangeRequest };
  onAnswered: () => void;
}) {
  const t = useTranslations("parent.approvals");
  const tStudent = useTranslations("student");
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;
  const toast = useToast();
  const { request } = item;
  const details = request.details;
  const name = firstNameOf(item.student_name);
  const isWaiting = request.status === RequestStatus.AwaitingGuardian;
  const guardianEvent = request.timeline.find((event) => event.by === RequestActor.Guardian);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [note, setNote] = useState("");
  const { submit, isSending, serverError, clearServerError } = useSubmit(DECISION_ERRORS);

  const lineLabel = (line: { code: string; name: string }) =>
    `${tStudent("lineCode", { code: line.code })} · ${line.name}`;

  function close() {
    setDecision(null);
    setNote("");
    clearServerError();
  }

  async function answer() {
    if (!decision) return;
    const body = { note: note.trim() || null };
    const send = decision === Decision.Approve ? approveAsGuardian : refuseAsGuardian;
    const done = await submit((idempotencyKey) =>
      send(request.request_id, body, { idempotencyKey }),
    );
    if (done) {
      toast.show({
        title: decision === Decision.Approve ? t("approvedToast") : t("refusedToast"),
        description: decision === Decision.Approve ? t("approvedToastBody", { name }) : undefined,
        tone: decision === Decision.Approve ? Tone.Success : Tone.Info,
      });
      close();
      onAnswered();
    }
  }

  return (
    <Card elevation={isWaiting ? "raised" : undefined}>
      <CardHeader
        title={t("cardTitle", { name: item.student_name })}
        description={t("cardMeta", {
          reference: request.reference,
          date: formatDateTime(request.submitted_at, locale),
        })}
        actions={<RequestStatusBadge status={request.status} />}
      />
      <CardBody className="flex flex-col gap-4">
        <ApprovalDetails details={details} name={name} />

        {isWaiting ? (
          <div className="flex flex-col gap-3">
            <p className="text-body-sm text-ink">{t("explain", { name })}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                iconStart={<Check className="size-4" />}
                onClick={() => setDecision(Decision.Approve)}
              >
                {t("approve")}
              </Button>
              <Button
                variant="secondary"
                iconStart={<X className="size-4" />}
                onClick={() => setDecision(Decision.Refuse)}
              >
                {t("refuse")}
              </Button>
            </div>
          </div>
        ) : guardianEvent ? (
          <Alert
            tone={guardianEvent.status === RequestStatus.Rejected ? Tone.Info : Tone.Success}
            title={
              guardianEvent.status === RequestStatus.Rejected
                ? t("youRefused", { date: formatDateTime(guardianEvent.at, locale) })
                : t("youApproved", { date: formatDateTime(guardianEvent.at, locale) })
            }
          >
            {guardianEvent.note ?? null}
          </Alert>
        ) : null}
      </CardBody>

      <Dialog
        open={decision !== null}
        onClose={close}
        title={decision === Decision.Approve ? t("approveTitle") : t("refuseTitle")}
        description={
          decision === Decision.Approve
            ? t("approveBody", { name, line: lineLabel(details.to_line) })
            : t("refuseBody", { name })
        }
        footer={
          <>
            <Button variant="secondary" onClick={close} disabled={isSending}>
              {t("back")}
            </Button>
            <Button
              variant={decision === Decision.Refuse ? "danger" : "primary"}
              onClick={answer}
              isLoading={isSending}
            >
              {decision === Decision.Approve ? t("approveConfirm") : t("refuseConfirm")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <TextAreaField
            label={decision === Decision.Refuse ? t("refuseNote", { name }) : t("approveNote")}
            optionalText={tCommon("optional")}
            rows={3}
            maxLength={NOTE_MAX_LENGTH}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          {serverError ? <Alert tone={Tone.Danger} title={t(`errors.${serverError}`)} /> : null}
        </div>
      </Dialog>
    </Card>
  );
}
