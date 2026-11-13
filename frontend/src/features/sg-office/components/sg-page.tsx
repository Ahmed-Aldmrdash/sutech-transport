"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { todayInCairo } from "@/lib/format";
import { getSgOverview } from "../api";
import { DayOverview } from "./day-overview";
import { WatchlistCard } from "./watchlist-card";

/** The Secretary General's page: who rode and which lines run late, without a phone call. */
export function SgPage() {
  const t = useTranslations("desk.sg");
  const [date, setDate] = useState(todayInCairo);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        description={t("lead")}
        actions={
          <ButtonLink href="/admin/reports" variant="secondary">
            {t("reportsLink")}
          </ButtonLink>
        }
      />
      <DayOverview
        date={date}
        onDateChange={setDate}
        load={(day, signal) => getSgOverview({ date: day }, { signal })}
      />
      <WatchlistCard date={date} />
    </div>
  );
}
