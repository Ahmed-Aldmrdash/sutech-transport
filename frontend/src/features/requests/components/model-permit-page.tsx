"use client";

import { Package } from "lucide-react";
import { useTranslations } from "next-intl";
import { BackLink } from "@/components/ui/back-link";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { getMySubscription } from "@/features/subscriptions/api";
import { SubscriptionStatus } from "@/features/subscriptions/schema";
import { AsyncStatus, useAsync } from "@/lib/hooks/use-async";
import { REQUESTS_PATH } from "./requests-page";
import { ModelPermitForm } from "./model-permit-form";

/**
 * The university's safety permit for bringing a project model onto the bus
 * ("تصريح دخول مجسم في باص الجامعة"), online. The student's details and the bus come from the
 * account and subscription; the student fills in the model, the times and who signs.
 */
export function ModelPermitPage() {
  const t = useTranslations("student.requests");
  const data = useAsync((signal) => getMySubscription({ signal }), []);

  const header = (
    <>
      <BackLink href={REQUESTS_PATH}>{t("title")}</BackLink>
      <PageHeader title={t("modelPermit.title")} description={t("modelPermit.lead")} />
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
  const { subscription } = data.data;
  return (
    <div className="flex flex-col gap-6">
      {header}
      {subscription?.status === SubscriptionStatus.Active ? (
        <ModelPermitForm subscription={subscription} />
      ) : (
        <EmptyState
          icon={<Package />}
          title={t("needsActiveTitle")}
          description={t("modelPermit.needsActiveBody")}
          action={<ButtonLink href="/student">{t("goHome")}</ButtonLink>}
        />
      )}
    </div>
  );
}
