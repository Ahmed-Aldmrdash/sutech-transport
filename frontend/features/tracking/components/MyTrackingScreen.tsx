"use client";

import { MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { Async } from "@/components/ui/Async";
import { ErrorCode } from "@/lib/api/errors";
import { useApi, usePolling } from "@/lib/api/use-api";
import { SubscribersOnly } from "@/features/subscriptions/components/SubscribersOnly";
import { getMyTracking } from "../api";
import { TrackingView } from "./TrackingView";

const ETA_REFRESH_MS = 20_000;

export function MyTrackingScreen() {
  const t = useTranslations("tracking");
  const query = useApi(getMyTracking);
  usePolling(query.reload, ETA_REFRESH_MS);
  return (
    <>
      <PageHeader title={t("title")} />
      {query.error?.code === ErrorCode.SubscriptionRequired ? (
        <SubscribersOnly icon={<MapPin aria-hidden />} title={t("inactiveTitle")} body={t("inactiveBody")} />
      ) : (
        <Async query={query}>{(data) => <TrackingView data={data} />}</Async>
      )}
    </>
  );
}
