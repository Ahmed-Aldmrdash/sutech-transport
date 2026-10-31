"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { Async } from "@/components/ui/Async";
import { Banner } from "@/components/ui/Banner";
import { Link } from "@/i18n/navigation";
import { ErrorCode } from "@/lib/api/errors";
import { useApi, usePolling } from "@/lib/api/use-api";
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
        <Banner tone="warning" title={t("inactiveTitle")} action={<Link href="/student" className="font-bold underline">{t("goHome")}</Link>}>
          {t("inactiveBody")}
        </Banner>
      ) : (
        <Async query={query}>{(data) => <TrackingView data={data} />}</Async>
      )}
    </>
  );
}
