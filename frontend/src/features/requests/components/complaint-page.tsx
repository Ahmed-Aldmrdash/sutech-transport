"use client";

import { MessageSquareWarning } from "lucide-react";
import { useTranslations } from "next-intl";
import { BackLink } from "@/components/ui/back-link";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { listLines } from "@/features/lines/api";
import { getMySubscription } from "@/features/subscriptions/api";
import { AsyncStatus, useAsync } from "@/lib/hooks/use-async";
import { COMPLAINTS_PATH } from "./requests-page";
import { ComplaintForm } from "./complaint-form";

export function ComplaintPage() {
  const t = useTranslations("student.requests.complaint");
  const data = useAsync(async (signal) => {
    const [mine, lines] = await Promise.all([getMySubscription({ signal }), listLines({ signal })]);
    return { subscription: mine.subscription, lines };
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <BackLink href={COMPLAINTS_PATH}>{t("title")}</BackLink>
      <PageHeader title={t("newTitle")} description={t("newLead")} />
      {data.status === AsyncStatus.Loading ? <Skeleton className="h-[28rem] w-full" /> : null}
      {data.status === AsyncStatus.Error ? (
        <ErrorState error={data.error} onRetry={data.reload} />
      ) : null}
      {data.status === AsyncStatus.Success && !data.data.subscription ? (
        <EmptyState
          icon={<MessageSquareWarning />}
          title={t("needsBookingTitle")}
          description={t("needsBookingBody")}
        />
      ) : null}
      {data.status === AsyncStatus.Success && data.data.subscription ? (
        <ComplaintForm subscription={data.data.subscription} lines={data.data.lines} />
      ) : null}
    </div>
  );
}
