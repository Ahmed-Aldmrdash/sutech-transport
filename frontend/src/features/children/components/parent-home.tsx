"use client";

import { CalendarCheck, UsersRound } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { SkeletonLines } from "@/components/ui/skeleton";
import { Tone } from "@/components/ui/tone";
import { SessionStatus } from "@/features/auth/session/session-store";
import { useSession } from "@/features/auth/session/use-session";
import { firstNameOf, userText } from "@/features/auth/user-text";
import { SubscriptionStatus } from "@/features/subscriptions/schema";
import { getChildTracking } from "@/features/tracking/api";
import { TrackingPanel } from "@/features/tracking/components/tracking-panel";
import type { Locale } from "@/i18n/routing";
import { formatClockTime } from "@/lib/format";
import { AsyncStatus } from "@/lib/hooks/use-async";
import type { Child } from "../schema";
import { useChildren } from "./children-provider";
import { DayStatusBanner, DaysOffList } from "./day-status";
import { useChildDay } from "./use-child-day";

const STATUS_TONE: Record<SubscriptionStatus, Tone> = {
  [SubscriptionStatus.Active]: Tone.Success,
  [SubscriptionStatus.Reserved]: Tone.Warning,
  [SubscriptionStatus.PaymentReview]: Tone.Info,
  [SubscriptionStatus.Expired]: Tone.Neutral,
  [SubscriptionStatus.Cancelled]: Tone.Neutral,
};

/** The guardian's home: every child's day at a glance, then each bus they ride, live. */
export function ParentHome() {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const session = useSession();
  const { children } = useChildren();
  const firstName =
    session.status === SessionStatus.SignedIn
      ? firstNameOf(userText(session.session.user, locale).name)
      : "";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("session.welcome", { name: firstName })}
        description={t("parent.home.lead")}
      />
      {children.length === 0 ? (
        <EmptyState
          icon={<UsersRound />}
          title={t("parent.noChildrenTitle")}
          description={t("parent.noChildrenBody")}
        />
      ) : null}
      {children.length > 0 ? (
        <>
          <div className="grid items-start gap-5 desktop:grid-cols-2">
            {children.map((child) => (
              <ChildCard key={child.student_id} child={child} />
            ))}
          </div>
          <LiveBuses family={children} />
        </>
      ) : null}
    </div>
  );
}

/** One map per bus: brothers and sisters on the same line share one. */
function LiveBuses({ family }: { family: readonly Child[] }) {
  const t = useTranslations("parent.home");
  const locale = useLocale() as Locale;
  const buses = new Map<string, Child[]>();
  for (const child of family) {
    const subscription = child.subscription;
    if (subscription?.status !== SubscriptionStatus.Active) continue;
    const riders = buses.get(subscription.line.line_id) ?? [];
    riders.push(child);
    buses.set(subscription.line.line_id, riders);
  }
  if (buses.size === 0) return null;
  const names = new Intl.ListFormat(locale, { type: "conjunction" });

  return (
    <section aria-labelledby="parent-live-title" className="flex flex-col gap-4">
      <h2 id="parent-live-title" className="text-h3 text-ink-strong">
        {t("liveTitle")}
      </h2>
      {[...buses.values()].map((riders) => {
        const [first] = riders;
        if (!first?.subscription) return null;
        return (
          <div key={first.subscription.line.line_id} className="flex flex-col gap-2">
            {family.length > 1 ? (
              <p className="text-body-sm font-bold text-ink-strong">
                {t("liveFor", {
                  code: first.subscription.line.code,
                  names: names.format(riders.map((rider) => firstNameOf(rider.name))),
                })}
              </p>
            ) : null}
            <TrackingPanel
              load={(signal) => getChildTracking(first.student_id, { signal })}
              loadKey={first.student_id}
              audience={{ who: "child", name: firstNameOf(first.name) }}
            />
          </div>
        );
      })}
    </section>
  );
}

function ChildCard({ child }: { child: Child }) {
  const t = useTranslations("parent");
  const tRoot = useTranslations();
  const locale = useLocale() as Locale;
  const subscription = child.subscription;
  const isActive = subscription?.status === SubscriptionStatus.Active;
  const name = firstNameOf(child.name);

  return (
    <Card elevation="raised">
      <CardHeader
        title={child.name}
        description={t("childMeta", { id: child.identifier, level: child.level ?? 0 })}
      />
      <CardBody className="flex flex-col gap-4">
        {subscription ? (
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={STATUS_TONE[subscription.status]}>
                {tRoot(`student.status.${subscription.status}`)}
              </Badge>
              <span className="text-body-sm font-bold text-ink-strong">
                {tRoot("student.lineCode", { code: subscription.line.code })} ·{" "}
                {subscription.line.name}
              </span>
            </div>
            <p className="text-body-sm text-ink">
              {t("home.pickup", {
                stop: subscription.stop.name,
                time: subscription.stop.pickup_time
                  ? formatClockTime(subscription.stop.pickup_time, locale)
                  : tRoot("student.toBeAnnounced"),
              })}
            </p>
          </div>
        ) : (
          <p className="text-body-sm text-ink">{t("home.noSubscription", { name })}</p>
        )}
        {isActive ? <ChildToday child={child} /> : null}
      </CardBody>
    </Card>
  );
}

function ChildToday({ child }: { child: Child }) {
  const t = useTranslations("parent.home");
  const day = useChildDay(child.student_id);
  return (
    <>
      {day.status === AsyncStatus.Loading ? <SkeletonLines lines={2} /> : null}
      {day.status === AsyncStatus.Error ? (
        <ErrorState error={day.error} onRetry={day.reload} />
      ) : null}
      {day.status === AsyncStatus.Success ? (
        <>
          <DayStatusBanner day={day.data} childName={child.name} />
          <DaysOffList day={day.data} />
        </>
      ) : null}
      <ButtonLink
        href={`/parent/day?child=${child.student_id}`}
        variant="secondary"
        size="sm"
        className="self-start"
        iconStart={<CalendarCheck className="size-4" />}
      >
        {t("openDay")}
      </ButtonLink>
    </>
  );
}
