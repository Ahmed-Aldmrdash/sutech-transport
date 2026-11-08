"use client";

import { Route } from "lucide-react";
import { useTranslations } from "next-intl";
import { BackLink } from "@/components/ui/back-link";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { listLines } from "@/features/lines/api";
import { getMySubscription } from "@/features/subscriptions/api";
import { SubscriptionStatus } from "@/features/subscriptions/schema";
import { AsyncStatus, useAsync } from "@/lib/hooks/use-async";
import { REQUESTS_PATH } from "./requests-page";
import { LineChangeForm } from "./line-change-form";

/** The university's line change form ("طلب تغيير خط السير"), online. */
export function LineChangePage() {
  const t = useTranslations("student.requests");
  const data = useAsync(async (signal) => {
    const [mine, lines] = await Promise.all([getMySubscription({ signal }), listLines({ signal })]);
    return { subscription: mine.subscription, lines };
  }, []);

  const header = (
    <>
      <BackLink href={REQUESTS_PATH}>{t("title")}</BackLink>
      <PageHeader title={t("lineChange.title")} description={t("lineChange.lead")} />
    </>
  );

  if (data.status === AsyncStatus.Loading) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <Skeleton className="h-[32rem] w-full" />
      </div>
    );
  }
  if (data.status === AsyncStatus.Error) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <ErrorState error={data.error} onRetry={data.reload} />
      </div>
    );
  }
  const { subscription, lines } = data.data;
  return (
    <div className="flex flex-col gap-6">
      {header}
      {subscription?.status === SubscriptionStatus.Active ? (
        <LineChangeForm subscription={subscription} lines={lines} />
      ) : (
        <EmptyState
          icon={<Route />}
          title={t("needsActiveTitle")}
          description={t("needsActiveBody")}
          action={<ButtonLink href="/student">{t("goHome")}</ButtonLink>}
        />
      )}
    </div>
  );
}
