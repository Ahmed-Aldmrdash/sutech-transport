"use client";

import { CircleCheck, CircleDashed, Clock, Hourglass, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Tone } from "@/components/ui/tone";
import { SubscriptionStatus } from "../schema";

const STYLE: Record<SubscriptionStatus | "none", { tone: Tone; icon: ReactNode }> = {
  none: { tone: Tone.Neutral, icon: <CircleDashed /> },
  [SubscriptionStatus.Reserved]: { tone: Tone.Warning, icon: <Clock /> },
  [SubscriptionStatus.PaymentReview]: { tone: Tone.Info, icon: <Hourglass /> },
  [SubscriptionStatus.Active]: { tone: Tone.Success, icon: <CircleCheck /> },
  [SubscriptionStatus.Expired]: { tone: Tone.Danger, icon: <XCircle /> },
  [SubscriptionStatus.Cancelled]: { tone: Tone.Neutral, icon: <XCircle /> },
};

export function SubscriptionStatusBadge({ status }: { status: SubscriptionStatus | "none" }) {
  const t = useTranslations("student.status");
  const { tone, icon } = STYLE[status];
  return (
    <Badge tone={tone} icon={icon}>
      {t(status)}
    </Badge>
  );
}
