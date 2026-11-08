"use client";

import { ReceiptText } from "lucide-react";
import { useTranslations } from "next-intl";
import { BackLink } from "@/components/ui/back-link";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { AsyncStatus, useAsync } from "@/lib/hooks/use-async";
import { getRefundPolicy } from "../api";
import { REQUESTS_PATH } from "./requests-page";
import { PolicyCard } from "./refund-policy-card";
import { RefundForm } from "./refund-form";

/** Cancelling a paid subscription for a refund, under the term's refund policy. */
export function RefundPage() {
  const t = useTranslations("student.requests");
  const policy = useAsync((signal) => getRefundPolicy({ signal }), []);
  const header = (
    <>
      <BackLink href={REQUESTS_PATH}>{t("title")}</BackLink>
      <PageHeader title={t("refund.title")} description={t("refund.lead")} />
    </>
  );

  if (policy.status === AsyncStatus.Loading) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  if (policy.status === AsyncStatus.Error) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <ErrorState error={policy.error} onRetry={policy.reload} />
      </div>
    );
  }

  const data = policy.data;
  const canRequest = data.subscription_id !== null && data.paid_piasters !== null;
  return (
    <div className="flex flex-col gap-6">
      {header}
      <div className="grid items-start gap-5 desktop:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {canRequest ? (
          <RefundForm policy={data} />
        ) : (
          <EmptyState
            icon={<ReceiptText />}
            title={t("needsActiveTitle")}
            description={t("refund.needsPaidBody")}
            action={<ButtonLink href="/student">{t("goHome")}</ButtonLink>}
          />
        )}
        <PolicyCard policy={data} />
      </div>
    </div>
  );
}
