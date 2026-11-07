"use client";

import { CalendarX2, CircleCheck, Clock, LogOut, UserX, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Tone } from "@/components/ui/tone";
import { RiderState } from "../schema";

const STATE_TONE: Record<RiderState, Tone> = {
  [RiderState.Waiting]: Tone.Neutral,
  [RiderState.Boarded]: Tone.Success,
  [RiderState.CheckedOut]: Tone.Warning,
  [RiderState.NotGoing]: Tone.Info,
  [RiderState.Absent]: Tone.Danger,
};

export const RIDER_STATE_ICON: Record<RiderState, LucideIcon> = {
  [RiderState.Waiting]: Clock,
  [RiderState.Boarded]: CircleCheck,
  [RiderState.CheckedOut]: LogOut,
  [RiderState.NotGoing]: CalendarX2,
  [RiderState.Absent]: UserX,
};

/** Where one rider stands on this trip; the word always says it, the colour helps. */
export function RiderStateBadge({ state }: { state: RiderState }) {
  const t = useTranslations("crew.state");
  const Icon = RIDER_STATE_ICON[state];
  return (
    <Badge tone={STATE_TONE[state]} icon={<Icon />}>
      {t(state)}
    </Badge>
  );
}
