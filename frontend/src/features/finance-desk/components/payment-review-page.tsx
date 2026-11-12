"use client";

import { FileText } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { BackLink } from "@/components/ui/back-link";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Tone } from "@/components/ui/tone";
import { CallLink, Fact } from "@/features/emergencies/components/sos-facts";
import { PaymentStatus } from "@/features/payments/schema";
import type { Locale } from "@/i18n/routing";
import { formatCalendarDate, formatDateTime, formatMoney } from "@/lib/format";
import { AsyncStatus, useAsync } from "@/lib/hooks/use-async";
import { getOfficePayment } from "../api";
import type { OfficePaymentDetail } from "../schema";
import { PaymentBadge } from "./payment-badge";
import { ReviewCard } from "./review-card";

/** One receipt with the student and the seat, and approve / reject while it waits. */
export function PaymentReviewPage({ paymentId }: { paymentId: string }) {
  const t = useTranslations("desk.payments");
  const state = useAsync((signal) => getOfficePayment(paymentId, { signal }), [paymentId]);
  const back = <BackLink href="/admin/payments">{t("back")}</BackLink>;

  if (state.status === AsyncStatus.Loading) {
    return (
      <div className="flex flex-col gap-6">
        {back}
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (state.status === AsyncStatus.Error) {
    return (
      <div className="flex flex-col gap-6">
        {back}
        <ErrorState error={state.error} onRetry={state.reload} />
      </div>
    );
  }
  const payment = state.data;
  return (
    <div className="flex flex-col gap-6">
      {back}
      <PageHeader
        eyebrow={t("detail.eyebrow", { reference: payment.reference_number })}
        title={payment.student.name}
        actions={<PaymentBadge status={payment.status} />}
      />
      <Outcome payment={payment} />
      <div className="grid items-start gap-5 desktop:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-5">
          <ReceiptCard payment={payment} />
          <OtherPayments payment={payment} />
        </div>
        <div className="flex flex-col gap-5">
          {payment.status === PaymentStatus.PendingReview ? (
            <ReviewCard payment={payment} onReviewed={state.refresh} />
          ) : null}
          <StudentCard payment={payment} />
        </div>
      </div>
    </div>
  );
}

function Outcome({ payment }: { payment: OfficePaymentDetail }) {
  const t = useTranslations("desk.payments.detail");
  const locale = useLocale() as Locale;
  if (payment.status === PaymentStatus.PendingReview) return null;
  const when = payment.reviewed_at ? formatDateTime(payment.reviewed_at, locale) : "";
  const by = payment.reviewed_by_name ?? "";
  if (payment.status === PaymentStatus.Approved) {
    return (
      <Alert tone={Tone.Success} title={t("approvedTitle")}>
        {t("decidedBy", { name: by, time: when })}
      </Alert>
    );
  }
  return (
    <Alert tone={Tone.Danger} title={t("rejectedTitle")}>
      <span className="block">{payment.rejection_reason}</span>
      <span className="mt-1 block text-caption">{t("decidedBy", { name: by, time: when })}</span>
    </Alert>
  );
}

function ReceiptCard({ payment }: { payment: OfficePaymentDetail }) {
  const t = useTranslations("desk.payments");
  const locale = useLocale() as Locale;
  const short = payment.amount_piasters < payment.price_piasters;
  return (
    <Card elevation="raised">
      <CardHeader title={t("detail.receipt")} headingLevel={2} />
      <CardBody className="flex flex-col gap-4">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Fact label={t("detail.amount")}>
            <span className={short ? "text-danger-text" : undefined}>
              {formatMoney(payment.amount_piasters, locale)}
            </span>
          </Fact>
          <Fact label={t("detail.price")}>{formatMoney(payment.price_piasters, locale)}</Fact>
          <Fact label={t("detail.method")}>{t(`methods.${payment.method}`)}</Fact>
          <Fact label={t("detail.reference")}>
            <bdi dir="ltr">{payment.reference_number}</bdi>
          </Fact>
          <Fact label={t("detail.paidOn")}>{formatCalendarDate(payment.paid_on, locale)}</Fact>
          <Fact label={t("detail.payer")}>{payment.payer_name}</Fact>
          <Fact label={t("detail.sent")}>{formatDateTime(payment.submitted_at, locale)}</Fact>
          <Fact label={t("detail.file")} icon={<FileText />}>
            {payment.file_url ? (
              <a
                href={payment.file_url}
                target="_blank"
                rel="noreferrer"
                className="text-brand underline focus-ring"
              >
                {payment.file_name ?? t("detail.openFile")}
              </a>
            ) : (
              <>
                <bdi>{payment.file_name ?? t("detail.noFile")}</bdi>
                {payment.file_name ? (
                  <span className="block text-caption font-normal text-ink-muted">
                    {t("detail.fileDemo")}
                  </span>
                ) : null}
              </>
            )}
          </Fact>
        </dl>
        {short ? <Alert tone={Tone.Warning} title={t("detail.shortAmount")} /> : null}
      </CardBody>
    </Card>
  );
}

function StudentCard({ payment }: { payment: OfficePaymentDetail }) {
  const t = useTranslations("desk.payments.detail");
  return (
    <Card>
      <CardHeader title={t("student")} headingLevel={2} />
      <CardBody>
        <dl className="flex flex-col gap-4">
          <Fact label={t("identifier")}>
            <bdi>{payment.student.identifier}</bdi>
          </Fact>
          <Fact label={t("phone")}>
            <CallLink name={payment.student.name} phone={payment.student.phone} />
          </Fact>
          <Fact label={t("seat")}>
            {t("seatValue", {
              code: payment.line.code,
              line: payment.line.name,
              stop: payment.stop_name,
            })}
          </Fact>
          <Fact label={t("subscription")}>
            {t(`subscriptionStatus.${payment.subscription_status}`)}
          </Fact>
        </dl>
      </CardBody>
    </Card>
  );
}

function OtherPayments({ payment }: { payment: OfficePaymentDetail }) {
  const t = useTranslations("desk.payments");
  const locale = useLocale() as Locale;
  if (payment.other_payments.length === 0) return null;
  return (
    <Card>
      <CardHeader title={t("detail.others")} headingLevel={2} />
      <CardBody>
        <ul className="flex flex-col divide-y divide-line">
          {payment.other_payments.map((item) => (
            <li key={item.payment_id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-body-sm font-bold text-ink-strong">
                  {t("row.summary", {
                    amount: formatMoney(item.amount_piasters, locale),
                    method: t(`methods.${item.method}`),
                    reference: item.reference_number,
                  })}
                </p>
                <PaymentBadge status={item.status} />
              </div>
              <p className="text-caption text-ink-muted">
                {t("row.sent", { time: formatDateTime(item.submitted_at, locale) })}
              </p>
              {item.rejection_reason ? (
                <p className="text-body-sm text-danger-text">{item.rejection_reason}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
