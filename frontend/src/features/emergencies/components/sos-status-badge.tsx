"use client";

import { useTranslations } from "next-intl";
import { Badge, LiveDot } from "@/components/ui/badge";
import { Tone } from "@/components/ui/tone";
import { SosStatus } from "@/features/sos/schema";

const STATUS_TONE: Record<SosStatus, Tone> = {
  [SosStatus.Open]: Tone.Danger,
  [SosStatus.Acknowledged]: Tone.Warning,
  [SosStatus.Closed]: Tone.Neutral,
};

export function SosStatusBadge({ status }: { status: SosStatus }) {
  const t = useTranslations("emergencies.status");
  return (
    <Badge
      tone={STATUS_TONE[status]}
      icon={status === SosStatus.Open ? <LiveDot className="bg-danger" /> : undefined}
    >
      {t(status)}
    </Badge>
  );
}
