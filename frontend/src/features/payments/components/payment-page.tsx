"use client";

import { Route, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { getMySubscription } from "@/features/subscriptions/api";
import { SubscriptionStatus } from "@/features/subscriptions/schema";
import { AsyncStatus, useAsync } from "@/lib/hooks/use-async";
import { getPaymentInstructions, listMyPayments } from "../api";
import { BankDetailsCard } from "./bank-details-card";
import { OfficePaymentCard } from "./office-payment-card";
import { PaymentHistory } from "./payment-history";
import { ReceiptForm } from "./receipt-form";
import { AmountDue, StatusAlert } from "./payment-status";

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
          {/* Where to pay comes first; the receipt form is for after paying. */}
          <div className="grid items-start gap-5 desktop:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <div className="flex flex-col gap-5">
              <BankDetailsCard instructions={instructions} />
              <OfficePaymentCard instructions={instructions} />
            </div>
            <ReceiptForm
              subscription={subscription}
              instructions={instructions}
              onSent={data.refresh}
            />
          </div>
        </>
      ) : null}
      <PaymentHistory payments={ownPayments} />
    </div>
  );
}
