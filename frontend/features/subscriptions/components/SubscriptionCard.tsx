"use client";

import type { ReactNode } from "react";
import { ArrowLeft, Bus, Clock, MapPin, QrCode } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Banner } from "@/components/ui/Banner";
import { Card } from "@/components/ui/Card";
import type { Term } from "@/features/term/schema";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/time";
import { formatCountdown, useNow } from "@/lib/use-now";
import { type Subscription, SubscriptionStatus } from "../schema";
import { SubscriptionPill } from "./SubscriptionPill";

const linkButton =
  "label-caps inline-flex min-h-12 items-center justify-center gap-2 rounded-md px-5 text-[15px] font-bold";

/** The student's subscription at a glance, with the one next step for its state. */
export function SubscriptionCard({ subscription, term }: { subscription: Subscription; term: Term }) {
  const t = useTranslations("student.home");
  const locale = useLocale();
  const now = useNow();
  const { status } = subscription;

  if (status === SubscriptionStatus.None || status === SubscriptionStatus.Cancelled || status === SubscriptionStatus.Refunded || status === SubscriptionStatus.Expired) {
    const open = term.current.booking === "open";
    return (
      <Card raised className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[18px] font-bold">{t("noSubscriptionTitle", { term: term.current.name })}</h2>
          {status !== SubscriptionStatus.None && <SubscriptionPill status={status} />}
        </div>
        {open ? (
          <>
            <p className="text-ink-muted">{t("bookingOpenBody", { date: formatDate(term.current.booking_closes_on, locale) })}</p>
            <Link href="/student/lines" className={`${linkButton} bg-brand text-on-brand hover:bg-brand-deep`}>
              <Bus className="size-4" aria-hidden />
              {t("bookNow")}
            </Link>
          </>
        ) : (
          <Banner tone="warning" title={t("bookingClosedTitle")}>
            {term.next ? t("nextTermOpens", { term: term.next.name, date: formatDate(term.next.booking_opens_on, locale) }) : t("bookingClosedBody")}
          </Banner>
        )}
      </Card>
    );
  }

  return (
    <Card raised className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[18px] font-bold">{t("mySubscription", { term: subscription.term_name })}</h2>
        <SubscriptionPill status={status} />
      </div>
      <dl className="grid gap-2 text-[15px]">
        <Row icon={<Bus className="size-4" aria-hidden />} label={t("line")} value={subscription.line_name} />
        <Row icon={<MapPin className="size-4" aria-hidden />} label={t("stop")} value={subscription.stop_name} />
        {subscription.price !== null && <Row label={t("price")} value={formatMoney(subscription.price, locale)} />}
      </dl>
      {subscription.assignment && (
        <Banner tone="info" title={t(`assignment.${subscription.assignment.kind}`, { line: subscription.assignment.line_name })}>
          {subscription.assignment.until && t("assignmentUntil", { date: formatDate(subscription.assignment.until, locale) })}
        </Banner>
      )}
      {status === SubscriptionStatus.Reserved && subscription.reserved_until && (
        <>
          {subscription.rejection_reason && (
            <Banner tone="danger" title={t("receiptRejected")}>
              {subscription.rejection_reason}
            </Banner>
          )}
          <Banner tone="warning" title={t("payWithin")}>
            <span className="num inline-flex items-center gap-1 font-bold" dir="ltr">
              <Clock className="size-4" aria-hidden />
              {formatCountdown(subscription.reserved_until, now)}
            </span>
          </Banner>
          <Link href="/student/payment" className={`${linkButton} bg-brand text-on-brand hover:bg-brand-deep`}>
            {t("payNow")}
            <ArrowLeft className="flip-rtl size-4" aria-hidden />
          </Link>
        </>
      )}
      {status === SubscriptionStatus.PendingPayment && <Banner tone="info" title={t("underReviewTitle")}>{t("underReviewBody")}</Banner>}
      {status === SubscriptionStatus.Active && (
        <Link href="/student/card" className={`${linkButton} border border-line-strong bg-surface-raised text-brand hover:bg-brand-soft`}>
          <QrCode className="size-4" aria-hidden />
          {t("showCard")}
        </Link>
      )}
    </Card>
  );
}

function Row({ icon, label, value }: { icon?: ReactNode; label: string; value: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="inline-flex items-center gap-1.5 text-ink-muted">
        {icon}
        {label}
      </dt>
      <dd className="text-end font-bold text-ink-strong">{value ?? "—"}</dd>
    </div>
  );
}
