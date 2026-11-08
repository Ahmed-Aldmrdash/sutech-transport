"use client";

import { BusFront, Play } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { Locale } from "@/i18n/routing";
import { SessionStatus } from "@/features/auth/session/session-store";
import { useSession } from "@/features/auth/session/use-session";
import { isMockMode } from "@/lib/config";
import { formatDateTime } from "@/lib/format";
import { AsyncStatus, useAsync } from "@/lib/hooks/use-async";
import { startDemoTrip } from "../demo-trip";
import { NoTrackingReason, type Tracking } from "../schema";
import { LiveTripView } from "./live-trip-view";

/** How often the page re-reads the bus position until the live WebSocket is in place. */
const TRACKING_REFRESH_MS = 5000;

/** Who the page is for: the rider ("your stop") or their guardian ("Yassin's stop"). */
export type TrackingAudience = { who: "self" } | { who: "child"; name: string };

interface TrackingPanelProps {
  load: (signal: AbortSignal) => Promise<Tracking>;
  /** Changes when the page should start over (another child picked). */
  loadKey: string;
  audience: TrackingAudience;
  /** Where "find a line" goes when there's no subscription. Omit to show no button. */
  linesHref?: string;
}

/** The live map with the bus status, the bus and its driver. Re-reads every few seconds. */
export function TrackingPanel({ load, loadKey, audience, linesHref }: TrackingPanelProps) {
  const t = useTranslations("tracking");
  const locale = useLocale() as Locale;
  const state = useAsync(load, [loadKey]);
  const { refresh } = state;
  const session = useSession();
  const viewerId = session.status === SessionStatus.SignedIn ? session.session.user.id : null;

  useEffect(() => {
    const timer = setInterval(refresh, TRACKING_REFRESH_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  if (state.status === AsyncStatus.Loading) {
    return (
      <div className="flex flex-col gap-5">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }
  if (state.status === AsyncStatus.Error) {
    return <ErrorState error={state.error} onRetry={state.reload} />;
  }

  const { trip, reason, next_departure_at: nextDeparture } = state.data;
  const name = audience.who === "child" ? audience.name : "";

  if (!trip) {
    if (reason === NoTrackingReason.NoSubscription) {
      return (
        <EmptyState
          icon={<BusFront />}
          title={t("noSubscriptionTitle", { who: audience.who, name })}
          description={t("noSubscriptionBody", { who: audience.who, name })}
          action={
            linesHref ? (
              <ButtonLink href={linesHref} withArrow>
                {t("findLine")}
              </ButtonLink>
            ) : undefined
          }
        />
      );
    }
    return (
      <EmptyState
        icon={<BusFront />}
        title={t("noTripTitle")}
        description={
          nextDeparture
            ? t("noTripBody", { time: formatDateTime(nextDeparture, locale) })
            : t("noTripBodyUnknown")
        }
        action={
          isMockMode && viewerId ? (
            <Button
              variant="secondary"
              iconStart={<Play className="size-4" />}
              onClick={() => {
                startDemoTrip(viewerId);
                refresh();
              }}
            >
              {t("playDemo")}
            </Button>
          ) : undefined
        }
      />
    );
  }

  return <LiveTripView trip={trip} audience={audience} />;
}
