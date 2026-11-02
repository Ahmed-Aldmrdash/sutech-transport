"use client";

import { IdCard, Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { DigitalCard } from "./digital-card";
import { CardLoadState, useRotatingCard } from "./use-rotating-card";

/** The digital bus pass. Locked until the subscription is active. */
export function CardPage() {
  const t = useTranslations();
  const { state, card, error, isRefreshing, reload } = useRotatingCard();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("nav.items.card")} description={t("student.card.lead")} />
      {state === CardLoadState.Loading ? (
        <Skeleton className="mx-auto h-[36rem] w-full max-w-md" />
      ) : null}
      {state === CardLoadState.Error ? <ErrorState error={error} onRetry={reload} /> : null}
      {state === CardLoadState.Locked ? (
        <EmptyState
          icon={<IdCard />}
          title={t("student.card.lockedTitle")}
          description={t("student.card.lockedBody")}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <ButtonLink href="/student/lines">{t("student.card.goToLines")}</ButtonLink>
              <ButtonLink href="/student/payment" variant="secondary">
                {t("student.card.goToPayment")}
              </ButtonLink>
            </div>
          }
        />
      ) : null}
      {state === CardLoadState.Ready && card ? (
        <>
          <DigitalCard card={card} isRefreshing={isRefreshing} onRefresh={() => void reload()} />
          <p className="mx-auto flex max-w-md items-start gap-2 text-body-sm text-ink-muted">
            <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-teal" />
            {t("student.card.tip")}
          </p>
        </>
      ) : null}
    </div>
  );
}
