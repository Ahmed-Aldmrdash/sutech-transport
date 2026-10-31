"use client";

import { MapPin, QrCode, Route } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMe } from "@/components/providers/SessionProvider";
import { Async } from "@/components/ui/Async";
import { AnnouncementFeed } from "@/features/announcements/components/AnnouncementFeed";
import { ExtraDepartures } from "@/features/departures/components/ExtraDepartures";
import { getMySubscription } from "@/features/subscriptions/api";
import { SubscriptionCard } from "@/features/subscriptions/components/SubscriptionCard";
import { isActive } from "@/features/subscriptions/schema";
import { getTerm } from "@/features/term/api";
import { Link } from "@/i18n/navigation";
import { combineQueries, useApi } from "@/lib/api/use-api";
import { TodayCard } from "./TodayCard";

export function StudentHome() {
  const me = useMe();
  const t = useTranslations("student.home");
  const tn = useTranslations("nav");
  const query = combineQueries(useApi(getMySubscription), useApi(getTerm));
  const shortcuts = [
    { href: "/student/card", icon: QrCode, label: tn("card") },
    { href: "/student/tracking", icon: MapPin, label: tn("tracking") },
    { href: "/student/lines", icon: Route, label: tn("lines") },
  ];
  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <section className="relative overflow-hidden rounded-lg bg-[image:var(--grad-brand)] p-5 text-white lg:p-7">
        <div aria-hidden className="absolute inset-0 bg-[url('/brand/pattern.svg')]" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-white/75">{t("greeting")}</p>
            <h1 className="text-[24px] leading-8 font-extrabold text-white lg:text-[30px] lg:leading-10">{me.name}</h1>
          </div>
          <ul className="flex gap-2">
            {shortcuts.map(({ href, icon: Icon, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="flex min-h-11 items-center gap-2 rounded-md bg-white/12 px-3 text-[14px] font-bold text-white hover:bg-white/20"
                >
                  <Icon className="size-4" aria-hidden />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:items-start lg:gap-6">
        <div className="flex min-w-0 flex-col gap-5">
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
        </div>
        <section aria-label={t("pinned")} className="flex min-w-0 flex-col gap-3">
          <AnnouncementFeed pinnedOnly limit={3} />
        </section>
      </div>
    </div>
  );
}
