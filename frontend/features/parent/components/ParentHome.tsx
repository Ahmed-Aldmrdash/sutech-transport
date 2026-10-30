"use client";

import { ArrowLeft, Bus, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { Async } from "@/components/ui/Async";
import { Card, CardTitle } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/States";
import { DayTimeline } from "@/features/attendance/components/DayTimeline";
import { SubscriptionPill } from "@/features/subscriptions/components/SubscriptionPill";
import { isActive } from "@/features/subscriptions/schema";
import { Link } from "@/i18n/navigation";
import { useApi } from "@/lib/api/use-api";
import { useLive } from "@/lib/realtime";
import { cairoDate } from "@/lib/time";
import { getChildDay } from "../api";
import type { Child } from "../schema";
import { useChildren } from "./ChildProvider";
import { ChildSwitcher } from "./ChildSwitcher";

export function ParentHome() {
  const t = useTranslations("parent");
  const { query, selected } = useChildren();
  return (
    <>
      <h1 className="mb-4 text-[24px] leading-8 font-extrabold text-ink-strong">{t("title")}</h1>
      <Async query={query}>
        {(list) =>
          list.length === 0 || !selected ? (
            <EmptyState title={t("noChildren")}>{t("noChildrenBody")}</EmptyState>
          ) : (
            <>
              <ChildSwitcher />
              <ChildOverview child={selected} />
            </>
          )
        }
      </Async>
    </>
  );
}

function ChildOverview({ child }: { child: Child }) {
  const t = useTranslations("parent");
  const day = useApi(() => getChildDay(child.student_id, cairoDate()), [child.student_id]);
  useLive("attendance.event", () => undefined);
  const sub = child.subscription;
  return (
    <div className="flex flex-col gap-4">
      <Card raised className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-[20px] font-extrabold text-ink-strong">{child.name}</h2>
            <p className="text-[14px] text-ink-muted">
              <span className="num">{child.student_id}</span> · {child.faculty} · {child.level}
            </p>
          </div>
          <SubscriptionPill status={sub.status} />
        </div>
        {sub.line_name && (
          <dl className="grid gap-1.5 text-[15px]">
            <div className="flex items-center gap-2">
              <Bus className="size-4 text-ink-muted" aria-hidden />
              <dt className="sr-only">{t("line")}</dt>
              <dd>{sub.assignment ? `${sub.assignment.line_name} (${t("transferred")})` : sub.line_name}</dd>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="size-4 text-ink-muted" aria-hidden />
              <dt className="sr-only">{t("stop")}</dt>
              <dd>{sub.stop_name}</dd>
            </div>
          </dl>
        )}
        {isActive(sub) && (
          <Link href="/parent/tracking" className="label-caps inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-teal font-bold text-on-teal">
            {t("trackBus")}
            <ArrowLeft className="flip-rtl size-4" aria-hidden />
          </Link>
        )}
      </Card>
      <Card>
        <CardTitle>{t("today")}</CardTitle>
        <Async query={day} skeleton={<Skeleton className="h-24" />}>
          {(record) => <DayTimeline events={record.events} emptyText={isActive(sub) ? t("todayEmpty") : t("notSubscribed")} />}
        </Async>
      </Card>
    </div>
  );
}
