"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Tone } from "@/components/ui/tone";
import { ViolationStatus } from "@/features/violations/schema";

const STATUS_TONE: Record<ViolationStatus, Tone> = {
  [ViolationStatus.Submitted]: Tone.Warning,
  [ViolationStatus.UnderReview]: Tone.Info,
  [ViolationStatus.Closed]: Tone.Neutral,
};

export function ViolationBadge({ status }: { status: ViolationStatus }) {
  const t = useTranslations("desk.violations.status");
  return <Badge tone={STATUS_TONE[status]}>{t(status)}</Badge>;
}
