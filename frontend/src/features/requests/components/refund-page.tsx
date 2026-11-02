"use client";

import { ReceiptText } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { BackLink } from "@/components/ui/back-link";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Radio } from "@/components/ui/choice";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { TextAreaField } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Tone } from "@/components/ui/tone";
import { useToast } from "@/components/ui/toast";
import { SessionStatus } from "@/features/auth/session/session-store";
import { useSession } from "@/features/auth/session/use-session";
import { RECEIPT_MAX_BYTES } from "@/features/payments/schema";
import { useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { formatCalendarDate, formatFileSize, formatMoney } from "@/lib/format";
import { AsyncStatus, useAsync } from "@/lib/hooks/use-async";
import { createRefund, getRefundPolicy } from "../api";
import { isRefundWindowOpen, refundAmount } from "../refund-policy";
import {
  normalizePhone,
  validateRefund,
  type FieldErrors,
  type RefundField,
  type RefundValues,
} from "../request-validation";
import {
  EXCEPTIONAL_REFUND_REASONS,
  REFUND_REASONS,
  RefundReason,
  type RefundPolicy,
} from "../schema";
import { AttachmentsField } from "./attachments-field";
import { REQUEST_SERVER_ERRORS, toUploads } from "./form-helpers";
import { GuardianFields } from "./guardian-fields";
import { REQUESTS_PATH } from "./requests-page";
import { useSubmit } from "@/lib/hooks/use-submit";

/** Cancelling a paid subscription for a refund, under the term's refund policy. */
export function RefundPage() {
  const t = useTranslations("student.requests");
  const policy = useAsync((signal) => getRefundPolicy({ signal }), []);
  const header = (
    <>
      <BackLink href={REQUESTS_PATH}>{t("title")}</BackLink>
      <PageHeader title={t("refund.title")} description={t("refund.lead")} />
    </>
  );

  if (policy.status === AsyncStatus.Loading) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  if (policy.status === AsyncStatus.Error) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <ErrorState error={policy.error} onRetry={policy.reload} />
      </div>
    );
  }

  const data = policy.data;
  const canRequest = data.subscription_id !== null && data.paid_piasters !== null;
  return (
    <div className="flex flex-col gap-6">
      {header}
      <div className="grid items-start gap-5 desktop:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {canRequest ? (
          <RefundForm policy={data} />
        ) : (
          <EmptyState
            icon={<ReceiptText />}
            title={t("needsActiveTitle")}
            description={t("refund.needsPaidBody")}
            action={<ButtonLink href="/student">{t("goHome")}</ButtonLink>}
          />
        )}
        <PolicyCard policy={data} />
      </div>
    </div>
  );
}

/** The dated deduction table, today's row marked, and how the money comes back. */
function PolicyCard({ policy }: { policy: RefundPolicy }) {
  const t = useTranslations("student.requests.refund");
  const locale = useLocale() as Locale;
  const day = (value: string) => formatCalendarDate(value, locale);

  return (
    <Card>
      <CardHeader title={t("policyTitle")} description={policy.term_name} />
      <CardBody className="flex flex-col gap-4">
        <ul className="flex flex-col gap-2">
          {policy.windows.map((window) => {
            const isToday = window.deduction_percent === policy.today_deduction_percent;
            return (
              <li
                key={window.from}
                className={cn(
                  "flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2.5",
                  isToday ? "border-brand bg-brand-soft" : "border-line",
                )}
              >
                <span className="text-body-sm text-ink-strong">
                  {window.to
                    ? t("windowRange", { from: day(window.from), to: day(window.to) })
                    : t("windowFrom", { from: day(window.from) })}
                </span>
                <span className="text-body-sm font-bold text-ink-strong">
                  {t("deductionValue", { percent: window.deduction_percent })}
                  {isToday ? <span className="ms-2 text-brand">{t("today")}</span> : null}
                </span>
              </li>
            );
          })}
        </ul>
        <ul className="flex list-disc flex-col gap-1.5 ps-5 text-body-sm text-ink">
          <li>{t("ruleCheque", { days: policy.payout_days })}</li>
          <li>{t("ruleProcessing", { days: policy.processing_days })}</li>
          <li>{t("ruleOriginalReceipt")}</li>
          <li>{t("ruleGuardian")}</li>
          <li>{t("ruleExceptional")}</li>
        </ul>
      </CardBody>
    </Card>
  );
}

function RefundForm({ policy }: { policy: RefundPolicy }) {
  const t = useTranslations("student.requests");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const toast = useToast();
  const session = useSession();
  const guardianName =
    session.status === SessionStatus.SignedIn ? (session.session.user.guardian_name ?? "") : "";
  const windowOpen = isRefundWindowOpen(policy.today_deduction_percent);
  const paid = policy.paid_piasters ?? 0;

  const [values, setValues] = useState<RefundValues>({
    reason: windowOpen ? RefundReason.Standard : "",
    explanation: "",
    guardianName,
    guardianPhone: "",
    guardianConsent: false,
    documents: [],
  });
  const [errors, setErrors] = useState<FieldErrors<RefundField>>({});
  const { submit, isSending, serverError } = useSubmit(REQUEST_SERVER_ERRORS);
  const isExceptional = values.reason !== "" && EXCEPTIONAL_REFUND_REASONS.includes(values.reason);

  const update = <K extends RefundField>(key: K, value: RefundValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };
  const fieldError = (key: RefundField) => {
    const error = errors[key];
    return error
      ? t(`errors.${error}`, { size: formatFileSize(RECEIPT_MAX_BYTES, locale) })
      : undefined;
  };

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validateRefund(values, { maxBytes: RECEIPT_MAX_BYTES });
    setErrors(found);
    if (Object.keys(found).length > 0 || values.reason === "" || !policy.subscription_id) return;
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
    if (created) {
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

          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-body-sm font-bold text-ink-strong">
              {t("refund.reason")}
            </legend>
            {REFUND_REASONS.map((reason) => {
              const isClosed = reason === RefundReason.Standard && !windowOpen;
              return (
                <Radio
                  key={reason}
                  name="reason"
                  value={reason}
                  disabled={isClosed}
                  label={t(`refund.reasons.${reason}.label`)}
                  description={
                    isClosed ? t("refund.standardClosed") : t(`refund.reasons.${reason}.hint`)
                  }
                  checked={values.reason === reason}
                  onChange={() => update("reason", reason)}
                />
              );
            })}
            {errors.reason ? (
              <p role="alert" className="text-body-sm text-danger">
                {fieldError("reason")}
              </p>
            ) : null}
          </fieldset>

          <TextAreaField
            label={t("refund.explanation")}
            hint={t("textHint")}
            required
            error={fieldError("explanation")}
            value={values.explanation}
            onChange={(event) => update("explanation", event.target.value)}
          />

          <AttachmentsField
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
            consent={values.guardianConsent}
            consentLabel={t("guardian.consentRefund")}
            errors={{
              name: fieldError("guardianName"),
              phone: fieldError("guardianPhone"),
              consent: fieldError("guardianConsent"),
            }}
            onName={(value) => update("guardianName", value)}
            onPhone={(value) => update("guardianPhone", value)}
            onConsent={(value) => update("guardianConsent", value)}
          />

          <dl className="grid gap-3 rounded-md bg-brand-soft p-4 sm:grid-cols-3">
            <div>
              <dt className="text-caption text-brand">{t("refund.paid")}</dt>
              <dd className="text-body font-bold text-ink-strong">{formatMoney(paid, locale)}</dd>
            </div>
            <div>
              <dt className="text-caption text-brand">{t("refund.deduction")}</dt>
              <dd className="text-body font-bold text-ink-strong">
                {isExceptional
                  ? t("refund.decidedByUniversity")
                  : t("refund.percent", { percent: policy.today_deduction_percent })}
              </dd>
            </div>
            <div>
              <dt className="text-caption text-brand">{t("refund.estimate")}</dt>
              <dd className="text-body font-bold text-ink-strong">
                {isExceptional || values.reason === ""
                  ? t("refund.decidedByUniversity")
                  : formatMoney(refundAmount(paid, policy.today_deduction_percent), locale)}
              </dd>
            </div>
          </dl>
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
    </Card>
  );
}
