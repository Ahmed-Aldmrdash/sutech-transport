"use client";

import { useLocale, useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { Tone } from "@/components/ui/tone";
import type { Locale } from "@/i18n/routing";
import { formatCalendarDate, formatMoney } from "@/lib/format";
import { SubscriptionStatus, type Subscription } from "../schema";
import { HoldCountdown } from "./hold-countdown";

/** What the current status means for the student, in one sentence or two. */
export function SubscriptionStatusMessage({
  subscription,
  onChanged,
}: {
  subscription: Subscription;
  onChanged: () => void;
}) {
  const t = useTranslations("student.home.subscription");
  const locale = useLocale() as Locale;
  const rejected = subscription.latest_payment?.status === "rejected";

  switch (subscription.status) {
    case SubscriptionStatus.Reserved:
      return (
        <div className="flex flex-col gap-3">
          {rejected ? (
            <Alert tone={Tone.Danger} title={t("rejectedTitle")}>
              {subscription.latest_payment?.rejection_reason}
            </Alert>
          ) : null}
          <div>
            <h3 className="text-h3 text-ink-strong">{t("reservedTitle")}</h3>
            <p className="mt-1 text-body text-ink-muted">
              {t("reservedBody", { amount: formatMoney(subscription.price_piasters, locale) })}
            </p>
          </div>
          {subscription.hold_expires_at ? (
            <HoldCountdown endsAt={subscription.hold_expires_at} onEnded={onChanged} />
          ) : null}
        </div>
      );
    case SubscriptionStatus.PaymentReview:
      return (
        <Alert tone={Tone.Info} title={t("reviewTitle")}>
          {t("reviewBody")}
        </Alert>
      );
    case SubscriptionStatus.Active:
      return (
        <Alert tone={Tone.Success} title={t("activeTitle")}>
          {t("activeBody", { date: formatCalendarDate(subscription.term.ends_on, locale) })}
        </Alert>
      );
    case SubscriptionStatus.Expired:
      return (
        <Alert tone={Tone.Warning} title={t("expiredTitle")}>
          {t("expiredBody")}
        </Alert>
      );
    case SubscriptionStatus.Cancelled:
      return (
        <Alert tone={Tone.Info} title={t("cancelledTitle")}>
          {t("cancelledBody")}
        </Alert>
      );
  }
}
