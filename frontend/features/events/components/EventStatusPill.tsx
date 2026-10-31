"use client";

import { useTranslations } from "next-intl";
import { Pill, type Tone } from "@/components/ui/Pill";
import type { EventBooking } from "../schema";

const TONE: Record<EventBooking["status"], Tone> = { awaiting_company: "warning", confirmed: "success", company_declined: "danger", cancelled: "neutral" };

export function EventStatusPill({ status }: { status: EventBooking["status"] }) {
  const t = useTranslations("admin.events.statuses");
  return <Pill tone={TONE[status]}>{t(status)}</Pill>;
}
