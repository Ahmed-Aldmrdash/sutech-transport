"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Tone } from "@/components/ui/tone";
import { PaymentStatus } from "@/features/payments/schema";

const STATUS_TONE: Record<PaymentStatus, Tone> = {
  [PaymentStatus.PendingReview]: Tone.Warning,
  [PaymentStatus.Approved]: Tone.Success,
  [PaymentStatus.Rejected]: Tone.Danger,
};

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  const t = useTranslations("desk.payments.status");
  return <Badge tone={STATUS_TONE[status]}>{t(status)}</Badge>;
}
