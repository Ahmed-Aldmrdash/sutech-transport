"use client";

import { useLocale, useTranslations } from "next-intl";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { SessionStatus } from "@/features/auth/session/session-store";
import { useSession } from "@/features/auth/session/use-session";
import { firstNameOf, userText } from "@/features/auth/user-text";
import { getMySubscription } from "@/features/subscriptions/api";
import { SubscriptionCard } from "@/features/subscriptions/components/subscription-card";
import { SubscriptionStatus } from "@/features/subscriptions/schema";
import type { Locale } from "@/i18n/routing";
import { AsyncStatus, useAsync } from "@/lib/hooks/use-async";
import { AlertsCard } from "./alerts-card";
import { NextTripCard } from "./next-trip-card";
import { SubscribeSteps } from "./subscribe-steps";

/** The student's home: subscription, next trip and bus, and the latest alerts. */
export function StudentHome() {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const session = useSession();
  const state = useAsync((signal) => getMySubscription({ signal }), []);
  const firstName =
    session.status === SessionStatus.SignedIn
      ? firstNameOf(userText(session.session.user, locale).name)
      : "";

  const subscription = state.status === AsyncStatus.Success ? state.data.subscription : null;
  const isActive = subscription?.status === SubscriptionStatus.Active;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("session.welcome", { name: firstName })}
        description={t("student.home.lead")}
      />
      <div className="grid items-start gap-5 desktop:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-5">
          {state.status === AsyncStatus.Loading ? <Skeleton className="h-72 w-full" /> : null}
          {state.status === AsyncStatus.Error ? (
            <ErrorState error={state.error} onRetry={state.reload} />
          ) : null}
          {state.status === AsyncStatus.Success ? (
            <SubscriptionCard subscription={subscription} onChanged={state.refresh} />
          ) : null}
          {isActive ? <NextTripCard /> : null}
          {state.status === AsyncStatus.Success && !isActive ? <SubscribeSteps /> : null}
        </div>
        <AlertsCard />
      </div>
    </div>
  );
}
