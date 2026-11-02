"use client";

import { Armchair, Ban } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Tone } from "@/components/ui/tone";

/** "3 seats left" in green, or "Full". */
export function SeatsBadge({ available }: { available: number }) {
  const t = useTranslations("student.lines");
  return available > 0 ? (
    <Badge tone={Tone.Success} icon={<Armchair />}>
      {t("seatsLeft", { count: available })}
    </Badge>
  ) : (
    <Badge tone={Tone.Neutral} icon={<Ban />}>
      {t("full")}
    </Badge>
  );
}
