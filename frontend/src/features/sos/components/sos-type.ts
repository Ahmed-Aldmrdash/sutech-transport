import { BusFront, CarFront, HeartPulse, type LucideIcon } from "lucide-react";
import { SosType } from "../schema";

export const SOS_TYPE_ICON: Record<SosType, LucideIcon> = {
  [SosType.Medical]: HeartPulse,
  [SosType.Breakdown]: BusFront,
  [SosType.Accident]: CarFront,
};
