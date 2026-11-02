"use client";

import { Route, ShieldCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Tone } from "@/components/ui/tone";
import { getMySubscription } from "@/features/subscriptions/api";
import { HoldCountdown } from "@/features/subscriptions/components/hold-countdown";
import { SubscriptionStatus, type Subscription } from "@/features/subscriptions/schema";
import type { Locale } from "@/i18n/routing";
import { formatMoney } from "@/lib/format";
import { AsyncStatus, useAsync } from "@/lib/hooks/use-async";
import { getPaymentInstructions, listMyPayments } from "../api";
import { BankDetailsCard } from "./bank-details-card";
import { OfficePaymentCard } from "./office-payment-card";
import { PaymentHistory } from "./payment-history";
import { ReceiptForm } from "./receipt-form";

/** Paying for the held seat: amount and deadline, the two accepted ways, and the receipts sent. */
export function PaymentPage() {
  const t = useTranslations();
  const data = useAsync(async (signal) => {
    const [mine, instructions, payments] = await Promise.all([
      getMySubscription({ signal }),
      getPaymentInstructions({ signal }),
      listMyPayments({ signal }),
    ]);
    return { subscription: mine.subscription, instructions, payments };
  }, []);

  const header = (
    <PageHeader title={t("nav.items.payment")} description={t("student.payment.lead")} />
  );

  if (data.status === AsyncStatus.Loading) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  if (data.status === AsyncStatus.Error) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <ErrorState error={data.error} onRetry={data.reload} />
      </div>
    );
  }

  const { subscription, instructions, payments } = data.data;
  const ownPayments = subscription
    ? payments.filter((payment) => payment.subscription_id === subscription.subscription_id)
    : [];

  if (!subscription || subscription.status === SubscriptionStatus.Cancelled) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <EmptyState
          icon={<Route />}
          title={t("student.payment.noBookingTitle")}
          description={t("student.payment.noBookingBody")}
          action={
            <ButtonLink href="/student/lines">
              {t("student.home.subscription.chooseLine")}
            </ButtonLink>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {header}
      <AmountDue subscription={subscription} onHoldEnded={data.refresh} />
      <StatusAlert subscription={subscription} />
      {subscription.status === SubscriptionStatus.Reserved ? (
        <>
          <p className="flex items-center gap-2 text-body-sm font-bold text-ink">
            <ShieldCheck aria-hidden="true" className="size-5 shrink-0 text-teal" />
            {t("student.payment.onlyTheseMethods")}
          </p>
          <div className="grid items-start gap-5 desktop:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <ReceiptForm
              subscription={subscription}
              instructions={instructions}
              onSent={data.refresh}
            />
            <div className="flex flex-col gap-5">
              <BankDetailsCard instructions={instructions} />
              <OfficePaymentCard instructions={instructions} />
            </div>
          </div>
        </>
      ) : null}
      <PaymentHistory payments={ownPayments} />
    </div>
  );
}

function AmountDue({
  subscription,
  onHoldEnded,
}: {
  subscription: Subscription;
  onHoldEnded: () => void;
}) {
  const t = useTranslations("student");
  const locale = useLocale() as Locale;
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 rounded-card bg-brand-soft p-4 sm:p-5">
      <div>
        <p className="text-label text-brand">{t("payment.amountDue")}</p>
        <p className="text-numeric text-ink-strong">
          {formatMoney(subscription.price_piasters, locale)}
        </p>
        <p className="text-body-sm text-ink">
          {t("payment.forLine", {
            line: `${t("lineCode", { code: subscription.line.code })} · ${subscription.line.name}`,
            term: subscription.term.name,
          })}
        </p>
      </div>
      {subscription.status === SubscriptionStatus.Reserved && subscription.hold_expires_at ? (
        <HoldCountdown endsAt={subscription.hold_expires_at} onEnded={onHoldEnded} />
      ) : null}
    </div>
  );
}

function StatusAlert({ subscription }: { subscription: Subscription }) {
  const t = useTranslations("student.payment");
  const tHome = useTranslations("student.home.subscription");
  const rejected = subscription.latest_payment?.status === "rejected";
  switch (subscription.status) {
    case SubscriptionStatus.Reserved:
      return rejected ? (
        <Alert tone={Tone.Danger} title={t("rejectedTitle")}>
          {t("rejectedBody", { reason: subscription.latest_payment?.rejection_reason ?? "" })}
        </Alert>
      ) : null;
    case SubscriptionStatus.PaymentReview:
      return (
        <Alert tone={Tone.Info} title={t("reviewTitle")}>
          {t("reviewBody")}
        </Alert>
      );
    case SubscriptionStatus.Active:
      return (
        <Alert tone={Tone.Success} title={t("paidTitle")}>
          {t("paidBody")}
        </Alert>
      );
    case SubscriptionStatus.Expired:
      return (
        <Alert
          tone={Tone.Warning}
          title={t("expiredTitle")}
          action={
            <ButtonLink href="/student/lines" variant="secondary" size="sm">
              {tHome("bookAgain")}
            </ButtonLink>
          }
        >
          {t("expiredBody")}
        </Alert>
      );
    default:
      return null;
  }
}
