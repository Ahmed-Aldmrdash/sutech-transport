"use client";

import { useLocale, useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Tone } from "@/components/ui/tone";
import { HoldCountdown } from "@/features/subscriptions/components/hold-countdown";
import { SubscriptionStatus, type Subscription } from "@/features/subscriptions/schema";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";

export function AmountDue({
  subscription,
  onHoldEnded,
}: {
  subscription: Subscription;
  onHoldEnded: () => void;
}) {
  const t = useTranslations("student");
  const locale = useLocale() as Locale;
  // "Amount due" only while it is still due: after paying it reads "paid" or "under review".
  const label =
    subscription.status === SubscriptionStatus.Active
      ? t("payment.amountPaid")
      : subscription.status === SubscriptionStatus.PaymentReview
        ? t("payment.amountInReview")
        : t("payment.amountDue");
  const isPaid = subscription.status === SubscriptionStatus.Active;
  return (
    <div
      className={cn(
        "flex flex-wrap items-end justify-between gap-4 rounded-card p-4 sm:p-5",
        isPaid ? "bg-success-soft" : "bg-brand-soft",
      )}
    >
      <div>
        <p className={cn("text-label", isPaid ? "text-success-text" : "text-brand")}>{label}</p>
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

export function StatusAlert({ subscription }: { subscription: Subscription }) {
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
