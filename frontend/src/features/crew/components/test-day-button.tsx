"use client";

import { FlaskConical } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { isMockMode } from "@/lib/config";
import { todayInCairo } from "@/lib/format";
import { startTestDay } from "../test-day";

/**
 * Test mode only: makes today a service day on a Friday, a Saturday or a holiday, so the
 * pages can be tried any day. Nothing in a live build.
 */
export function TestDayButton({ onStarted }: { onStarted: () => void }) {
  const t = useTranslations("crew.gate");
  if (!isMockMode) return null;
  return (
    <Button
      variant="secondary"
      iconStart={<FlaskConical className="size-4" />}
      onClick={() => {
        startTestDay(todayInCairo());
        onStarted();
      }}
    >
      {t("testDay")}
    </Button>
  );
}
