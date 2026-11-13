"use client";

import { Hourglass, IdCard, Info, RotateCw, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { getMySubscription } from "@/features/subscriptions/api";
import { SubscriptionStatus } from "@/features/subscriptions/schema";
import { ClientErrorCode, isApiError } from "@/lib/api/errors";
import { AsyncStatus, useAsync } from "@/lib/hooks/use-async";
import { readSavedCard } from "../saved-card";
import { DigitalCard } from "./digital-card";
import { SavedCardView } from "./saved-card-view";
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
      {state === CardLoadState.Error ? <CardError error={error} onRetry={reload} /> : null}
      {state === CardLoadState.Locked ? <LockedCard /> : null}
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

/**
 * No pass yet: says what's missing for this student. A receipt under review is not "choose a
 * line" (they already did): it says the pass opens once Finance approves.
 */
function LockedCard() {
  const t = useTranslations("student.card");
  const mine = useAsync((signal) => getMySubscription({ signal }), []);
  if (mine.status === AsyncStatus.Loading) {
    return <Skeleton className="mx-auto h-48 w-full max-w-md" />;
  }
  const status = mine.status === AsyncStatus.Success ? mine.data.subscription?.status : undefined;
  if (status === SubscriptionStatus.PaymentReview || status === SubscriptionStatus.Reserved) {
    const inReview = status === SubscriptionStatus.PaymentReview;
    return (
      <EmptyState
        icon={inReview ? <Hourglass /> : <Wallet />}
        title={inReview ? t("reviewTitle") : t("payTitle")}
        description={inReview ? t("reviewBody") : t("payBody")}
        action={
          <ButtonLink href="/student/payment" variant={inReview ? "secondary" : "primary"}>
            {t("goToPayment")}
          </ButtonLink>
        }
      />
    );
  }
  return (
    <EmptyState
      icon={<IdCard />}
      title={t("lockedTitle")}
      description={t("lockedBody")}
      action={<ButtonLink href="/student/lines">{t("goToLines")}</ButtonLink>}
    />
  );
}

/** Without internet, the last card seen (details only: the code needs the server). */
function CardError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const t = useTranslations("errors");
  const offline =
    isApiError(error) &&
    (error.code === ClientErrorCode.Network || error.code === ClientErrorCode.Timeout);
  const saved = offline ? readSavedCard() : null;
  if (!saved) return <ErrorState error={error} onRetry={onRetry} />;
  return (
    <div className="flex flex-col items-center gap-4">
      <SavedCardView card={saved} />
      <Button variant="secondary" iconStart={<RotateCw className="size-4" />} onClick={onRetry}>
        {t("retry")}
      </Button>
    </div>
  );
}
