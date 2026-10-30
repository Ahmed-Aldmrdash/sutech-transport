"use client";

import { useTranslations } from "next-intl";
import { useMe } from "@/components/providers/SessionProvider";
import { Async } from "@/components/ui/Async";
import { AnnouncementFeed } from "@/features/announcements/components/AnnouncementFeed";
import { ExtraDepartures } from "@/features/departures/components/ExtraDepartures";
import { getMySubscription } from "@/features/subscriptions/api";
import { SubscriptionCard } from "@/features/subscriptions/components/SubscriptionCard";
import { isActive } from "@/features/subscriptions/schema";
import { getTerm } from "@/features/term/api";
import { combineQueries, useApi } from "@/lib/api/use-api";
import { TodayCard } from "./TodayCard";

export function StudentHome() {
  const me = useMe();
  const t = useTranslations("student.home");
  const query = combineQueries(useApi(getMySubscription), useApi(getTerm));
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-ink-muted">{t("greeting")}</p>
        <h1 className="text-[24px] leading-8 font-extrabold text-ink-strong">{me.name}</h1>
      </div>
      <Async query={query}>
        {([sub, current]) => (
          <>
            <SubscriptionCard subscription={sub} term={current} />
            {isActive(sub) && (
              <>
                <TodayCard />
                <ExtraDepartures />
              </>
            )}
          </>
        )}
      </Async>
      <section aria-label={t("pinned")} className="flex flex-col gap-3">
        <AnnouncementFeed pinnedOnly limit={3} />
      </section>
    </div>
  );
}
