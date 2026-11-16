"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Tone } from "@/components/ui/tone";
import { Standing } from "../schema";

const STANDING_TONE: Record<Standing, Tone> = {
  [Standing.Good]: Tone.Success,
  [Standing.Warned]: Tone.Warning,
  [Standing.Suspended]: Tone.Danger,
  [Standing.Banned]: Tone.Danger,
};

/** A student's standing; "good" shows nothing unless asked. */
export function StandingBadge({ standing, showGood }: { standing: Standing; showGood?: boolean }) {
  const t = useTranslations("discipline.standing");
  if (standing === Standing.Good && !showGood) return null;
  return <Badge tone={STANDING_TONE[standing]}>{t(standing)}</Badge>;
}
