"use client";

import { CalendarX2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { getMySubscription } from "@/features/subscriptions/api";
import { SubscriptionStatus } from "@/features/subscriptions/schema";
import { AsyncStatus, useAsync } from "@/lib/hooks/use-async";
import { listMyAbsences } from "../api";
import { ReportForm } from "./not-going-form";
import { Upcoming } from "./not-going-upcoming";

/** "Not going today": tells the driver, the supervisor and the guardian before the bus leaves. */
export function NotGoingPage() {
  const t = useTranslations("student.notGoing");
  const state = useAsync(async (signal) => {
    const mine = await getMySubscription({ signal });
    if (mine.subscription?.status !== SubscriptionStatus.Active) return null;
    return listMyAbsences({ signal });
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("lead")} />
      {state.status === AsyncStatus.Loading ? <Skeleton className="h-96 w-full" /> : null}
      {state.status === AsyncStatus.Error ? (
        <ErrorState error={state.error} onRetry={state.reload} />
      ) : null}
      {state.status === AsyncStatus.Success && state.data === null ? (
        <EmptyState
          icon={<CalendarX2 />}
          title={t("needsActiveTitle")}
          description={t("needsActiveBody")}
          action={<ButtonLink href="/student">{t("goHome")}</ButtonLink>}
        />
      ) : null}
      {state.status === AsyncStatus.Success && state.data !== null ? (
        <div className="grid grid-cols-1 items-start gap-5 desktop:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <ReportForm data={state.data} onDone={state.refresh} />
          <Upcoming items={state.data.upcoming} onChanged={state.refresh} />
        </div>
      ) : null}
    </div>
  );
}
