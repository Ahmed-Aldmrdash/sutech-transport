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
import { ChildSwitcher } from "./child-switcher";
import { useChildren } from "./children-provider";
import { DayStatusBanner } from "./day-status";
import { useChildDay } from "./use-child-day";

const STATUS_TONE: Record<SubscriptionStatus, Tone> = {
  [SubscriptionStatus.Active]: Tone.Success,
  [SubscriptionStatus.Reserved]: Tone.Warning,
  [SubscriptionStatus.PaymentReview]: Tone.Info,
  [SubscriptionStatus.Expired]: Tone.Neutral,
  [SubscriptionStatus.Cancelled]: Tone.Neutral,
};

/** The guardian's home: the child's subscription, where they are today, and the bus live. */
export function ParentHome() {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const session = useSession();
  const { selected } = useChildren();
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
      <ChildSwitcher />
      {selected ? (
        <ChildOverview key={selected.student_id} child={selected} />
      ) : (
        <EmptyState
          icon={<UsersRound />}
          title={t("parent.noChildrenTitle")}
          description={t("parent.noChildrenBody")}
        />
      )}
    </div>
  );
}

function ChildOverview({ child }: { child: Child }) {
  const t = useTranslations("parent");
  const tRoot = useTranslations();
  const locale = useLocale() as Locale;
  const day = useChildDay(child.student_id);
  const subscription = child.subscription;
  const name = firstNameOf(child.name);

  return (
    <div className="grid items-start gap-5 desktop:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div className="flex flex-col gap-5">
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
            {subscription ? (
              <>
                {day.status === AsyncStatus.Loading ? <SkeletonLines lines={2} /> : null}
                {day.status === AsyncStatus.Error ? (
                  <ErrorState error={day.error} onRetry={day.reload} />
                ) : null}
                {day.status === AsyncStatus.Success ? (
                  <DayStatusBanner day={day.data} childName={child.name} />
                ) : null}
                <ButtonLink
                  href="/parent/day"
                  variant="secondary"
                  size="sm"
                  className="self-start"
                  iconStart={<CalendarCheck className="size-4" />}
                >
                  {t("home.openDay")}
                </ButtonLink>
              </>
            ) : null}
          </CardBody>
        </Card>
      </div>
      <section aria-labelledby="parent-live-title" className="flex flex-col gap-3">
        <h2 id="parent-live-title" className="text-h3 text-ink-strong">
          {t("home.liveTitle")}
        </h2>
        <TrackingPanel
          load={(signal) => getChildTracking(child.student_id, { signal })}
          loadKey={child.student_id}
          audience={{ who: "child", name }}
        />
      </section>
    </div>
  );
}
