"use client";

import { useRequestForm } from "./use-request-form";
import { ReasonChoice, RefundEstimate } from "./refund-fields";
import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { TextAreaField } from "@/components/ui/input";
import { Tone } from "@/components/ui/tone";
import { useToast } from "@/components/ui/toast";
import { SessionStatus } from "@/features/auth/session/session-store";
import { useSession } from "@/features/auth/session/use-session";
import { userText } from "@/features/auth/user-text";
import { RECEIPT_MAX_BYTES } from "@/features/payments/schema";
import { useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatFileSize } from "@/lib/format";
import { createRefund, listMyRequests } from "../api";
import { isRefundWindowOpen } from "../refund-policy";
import { normalizePhone, validateRefund, type RefundValues } from "../request-validation";
import {
  EXCEPTIONAL_REFUND_REASONS,
  OPEN_REQUEST_STATUSES,
  RefundReason,
  RequestKind,
  type RefundPolicy,
} from "../schema";
import { AttachmentsField } from "./attachments-field";
import { REQUEST_SERVER_ERRORS, toUploads } from "./form-helpers";
import { GuardianFields } from "./guardian-fields";
import { REQUESTS_PATH } from "./requests-page";
import { useSubmit } from "@/lib/hooks/use-submit";
import { focusFirstError } from "@/lib/forms/focus-first-error";

export function RefundForm({ policy }: { policy: RefundPolicy }) {
  const t = useTranslations("student.requests");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const toast = useToast();
  const session = useSession();
  const guardianName =
    session.status === SessionStatus.SignedIn
      ? (userText(session.session.user, locale).guardianName ?? "")
      : "";
  const windowOpen = isRefundWindowOpen(policy.today_deduction_percent);
  const paid = policy.paid_piasters ?? 0;

  const { values, setErrors, update, fieldError, clearDraft } = useRequestForm<RefundValues>(
    "refund",
    {
      reason: windowOpen ? RefundReason.Standard : "",
      explanation: "",
      guardianName,
      guardianPhone: "",
      guardianConsent: false,
      documents: [],
    },
  );
  const { submit, isSending, serverError } = useSubmit(REQUEST_SERVER_ERRORS);
  const isExceptional = values.reason !== "" && EXCEPTIONAL_REFUND_REASONS.includes(values.reason);
  // A refund ends a paid subscription: it is confirmed first, and an open line change is named.
  const [confirming, setConfirming] = useState(false);
  const [openLineChange, setOpenLineChange] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const form = event.currentTarget as HTMLElement;
    const found = validateRefund(values, { maxBytes: RECEIPT_MAX_BYTES });
    setErrors(found);
    focusFirstError(form);
    if (Object.keys(found).length > 0 || values.reason === "" || !policy.subscription_id) return;
    setOpenLineChange(null);
    setConfirming(true);
    const lineChanges = await listMyRequests(RequestKind.LineChange).catch(() => []);
    const open = lineChanges.find((item) => OPEN_REQUEST_STATUSES.includes(item.status));
    setOpenLineChange(open?.reference ?? null);
  }

  async function send() {
    if (values.reason === "" || !policy.subscription_id) return;
    const { reason } = values;
    const subscriptionId = policy.subscription_id;
    const created = await submit(async (idempotencyKey) =>
      createRefund(
        {
          subscription_id: subscriptionId,
          reason,
          explanation: values.explanation.trim(),
          guardian_name: values.guardianName.trim(),
          guardian_phone: normalizePhone(values.guardianPhone),
          guardian_consent: true,
          documents: await toUploads(values.documents),
        },
        { idempotencyKey },
      ),
    );
    setConfirming(false);
    if (created) {
      clearDraft();
      toast.show({ title: t("sent"), description: t("sentBody"), tone: Tone.Success });
      router.replace(`${REQUESTS_PATH}/${created.request_id}`);
    }
  }

  return (
    <Card elevation="raised">
      <CardBody>
        <form noValidate onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-5">
          {!windowOpen ? (
            <Alert tone={Tone.Warning} title={t("refund.closedTitle")}>
              {t("refund.closedBody")}
            </Alert>
          ) : null}

          <ReasonChoice
            value={values.reason}
            windowOpen={windowOpen}
            error={fieldError("reason")}
            onChange={(reason) => update("reason", reason)}
          />

          <TextAreaField
            label={t("refund.explanation")}
            hint={t("textHint")}
            required
            error={fieldError("explanation")}
            value={values.explanation}
            onChange={(event) => update("explanation", event.target.value)}
          />

          <AttachmentsField
            maxBytes={RECEIPT_MAX_BYTES}
            label={t("refund.documents")}
            hint={t("refund.documentsHint", { size: formatFileSize(RECEIPT_MAX_BYTES, locale) })}
            required={isExceptional}
            files={values.documents}
            error={fieldError("documents")}
            onChange={(files) => update("documents", files)}
          />

          <GuardianFields
            name={values.guardianName}
            phone={values.guardianPhone}
            consent={{
              checked: values.guardianConsent,
              label: t("guardian.consentRefund"),
              error: fieldError("guardianConsent"),
              onChange: (value) => update("guardianConsent", value),
            }}
            errors={{ name: fieldError("guardianName"), phone: fieldError("guardianPhone") }}
            onName={(value) => update("guardianName", value)}
            onPhone={(value) => update("guardianPhone", value)}
          />

          <RefundEstimate
            paid={paid}
            deductionPercent={policy.today_deduction_percent}
            reason={values.reason}
          />
          <p className="text-body-sm text-ink-muted">{t("refund.cancelWarning")}</p>

          {serverError ? (
            <Alert
              tone={Tone.Danger}
              title={t(`serverErrors.${serverError}`, {
                size: formatFileSize(RECEIPT_MAX_BYTES, locale),
              })}
            />
          ) : null}
          <Button type="submit" withArrow isLoading={isSending} className="self-start">
            {t("refund.submit")}
          </Button>
        </form>
      </CardBody>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => void send()}
        isConfirming={isSending}
        destructive
        title={t("refund.confirmTitle")}
        description={t("refund.confirmBody")}
        confirmLabel={t("refund.confirm")}
      >
        {openLineChange ? (
          <Alert
            tone={Tone.Warning}
            title={t("refund.confirmOpenLineChange", { reference: openLineChange })}
          />
        ) : null}
      </ConfirmDialog>
    </Card>
  );
}
