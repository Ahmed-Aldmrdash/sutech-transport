"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Tone } from "@/components/ui/tone";
import { SubscriptionStatus } from "@/features/subscriptions/schema";

const TONE: Record<SubscriptionStatus, Tone> = {
  [SubscriptionStatus.Reserved]: Tone.Warning,
  [SubscriptionStatus.PaymentReview]: Tone.Info,
  [SubscriptionStatus.Active]: Tone.Success,
  [SubscriptionStatus.Expired]: Tone.Neutral,
  [SubscriptionStatus.Cancelled]: Tone.Neutral,
};

/** A student's seat this term, as the office words it. */
export function SubscriptionBadge({ status }: { status: SubscriptionStatus | null }) {
  const t = useTranslations("desk.ops.students.statuses");
  if (!status) return <Badge>{t("none")}</Badge>;
  return <Badge tone={TONE[status]}>{t(status)}</Badge>;
}
