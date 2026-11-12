"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Tone } from "@/components/ui/tone";
import { DeskStage } from "../schema";

const STAGE_TONE: Record<DeskStage, Tone> = {
  [DeskStage.New]: Tone.Warning,
  [DeskStage.InReview]: Tone.Info,
  [DeskStage.Closed]: Tone.Neutral,
};

export function StageBadge({ stage }: { stage: DeskStage }) {
  const t = useTranslations("desk.requests.stages");
  return <Badge tone={STAGE_TONE[stage]}>{t(stage)}</Badge>;
}
