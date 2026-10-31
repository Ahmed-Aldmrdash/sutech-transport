"use client";

import { useTranslations } from "next-intl";
import { Pill, type Tone } from "@/components/ui/Pill";
import { SubscriptionStatus } from "../schema";

const TONE: Record<SubscriptionStatus, Tone> = {
  [SubscriptionStatus.None]: "neutral",
  [SubscriptionStatus.Reserved]: "warning",
  [SubscriptionStatus.PendingPayment]: "teal",
  [SubscriptionStatus.Active]: "success",
  [SubscriptionStatus.Expired]: "neutral",
  [SubscriptionStatus.Cancelled]: "danger",
  [SubscriptionStatus.Refunded]: "neutral",
};

export function SubscriptionPill({ status }: { status: SubscriptionStatus }) {
  const t = useTranslations("status.subscription");
  return <Pill tone={TONE[status]}>{t(status)}</Pill>;
}
