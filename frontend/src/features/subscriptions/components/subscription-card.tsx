"use client";

import { ArrowRight, IdCard, Route, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { SubscriptionStatus, type Subscription } from "../schema";
import { CancelBookingButton } from "./cancel-booking-button";
import { SubscriptionFacts } from "./subscription-facts";
import { SubscriptionStatusBadge } from "./subscription-status-badge";
import { SubscriptionStatusMessage } from "./subscription-status-message";

const STUDENT_PATHS = {
  lines: "/student/lines",
  payment: "/student/payment",
  card: "/student/card",
} as const;

/** The student's subscription at a glance, with the one next step that matters. */
export function SubscriptionCard({
  subscription,
  onChanged,
}: {
  subscription: Subscription | null;
  onChanged: () => void;
}) {
  const t = useTranslations("student.home.subscription");
  const status = subscription?.status ?? "none";

  return (
    <Card elevation="raised" aria-labelledby="subscription-title">
      <CardHeader
        title={<span id="subscription-title">{t("title")}</span>}
        actions={<SubscriptionStatusBadge status={status} />}
      />
      <CardBody className="flex flex-col gap-4">
        {subscription ? (
          <SubscriptionStatusMessage subscription={subscription} onChanged={onChanged} />
        ) : null}
        {subscription ? <SubscriptionFacts subscription={subscription} /> : null}
        {!subscription ? (
          <div>
            <h3 className="text-h3 text-ink-strong">{t("noneTitle")}</h3>
            <p className="mt-1 text-body text-ink-muted">{t("noneBody")}</p>
          </div>
        ) : null}
      </CardBody>
      <CardFooter className="justify-start">
        <NextAction subscription={subscription} onChanged={onChanged} />
      </CardFooter>
    </Card>
  );
}

function NextAction({
  subscription,
  onChanged,
}: {
  subscription: Subscription | null;
  onChanged: () => void;
}) {
  const t = useTranslations("student.home.subscription");
  const arrow = <ArrowRight aria-hidden="true" className="size-4 rtl:-scale-x-100" />;

  switch (subscription?.status) {
    case SubscriptionStatus.Reserved:
      return (
        <>
          <ButtonLink href={STUDENT_PATHS.payment} iconStart={<Wallet className="size-4" />}>
            {t("payNow")}
          </ButtonLink>
          <CancelBookingButton subscription={subscription} onCancelled={onChanged} />
        </>
      );
    case SubscriptionStatus.PaymentReview:
      return (
        <ButtonLink href={STUDENT_PATHS.payment} variant="secondary" iconEnd={arrow}>
          {t("viewPayment")}
        </ButtonLink>
      );
    case SubscriptionStatus.Active:
      return (
        <ButtonLink href={STUDENT_PATHS.card} iconStart={<IdCard className="size-4" />}>
          {t("showCard")}
        </ButtonLink>
      );
    case SubscriptionStatus.Expired:
    case SubscriptionStatus.Cancelled:
      return (
        <ButtonLink href={STUDENT_PATHS.lines} iconStart={<Route className="size-4" />}>
          {t("bookAgain")}
        </ButtonLink>
      );
    default:
      return (
        <ButtonLink href={STUDENT_PATHS.lines} iconStart={<Route className="size-4" />}>
          {t("chooseLine")}
        </ButtonLink>
      );
  }
}
