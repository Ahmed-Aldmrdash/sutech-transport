"use client";

import { CircleCheck, RotateCw, WifiOff } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardFooter } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { SkeletonLines } from "@/components/ui/skeleton";
import { getHealth } from "@/features/system/api";
import { ApiError, ClientErrorCode, HTTP_STATUS_NONE } from "@/lib/api/errors";
import { appConfig } from "@/lib/config";
import { formatDateTime } from "@/lib/format";
import { AsyncStatus, useAsync } from "@/lib/hooks/use-async";
import { GallerySection } from "./gallery-section";

function simulatedOffline(): Promise<never> {
  return Promise.reject(new ApiError(HTTP_STATUS_NONE, ClientErrorCode.Network, "Simulated"));
}

/** A live example of the data layer: a typed, validated call with loading and error states. */
export function ApiSection() {
  const t = useTranslations("gallery");
  const locale = useLocale();
  const [simulateError, setSimulateError] = useState(false);
  const health = useAsync(
    (signal) => (simulateError ? simulatedOffline() : getHealth({ signal })),
    [simulateError],
  );

  return (
    <GallerySection id="api" title={t("sections.api")} description={t("api.body")}>
      {health.status === AsyncStatus.Error ? (
        <ErrorState
          error={health.error}
          onRetry={() => {
            setSimulateError(false);
            health.reload();
          }}
        />
      ) : (
        <Card className="max-w-xl">
          <CardBody>
            {health.status === AsyncStatus.Loading ? (
              <SkeletonLines lines={4} />
            ) : (
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-body-sm">
                <dt className="text-ink-muted">{t("api.mode")}</dt>
                <dd>
                  <code dir="ltr" className="font-mono text-ink-strong">
                    {appConfig.apiMode}
                  </code>
                </dd>
                <dt className="text-ink-muted">{t("api.status")}</dt>
                <dd>
                  <Badge tone="success" icon={<CircleCheck />}>
                    {health.data.status}
                  </Badge>
                </dd>
                <dt className="text-ink-muted">{t("api.version")}</dt>
                <dd>
                  <code dir="ltr" className="font-mono text-ink-strong">
                    {health.data.version}
                  </code>
                </dd>
                <dt className="text-ink-muted">{t("api.serverTime")}</dt>
                <dd className="text-ink-strong num">
                  {formatDateTime(health.data.server_time, locale)}
                </dd>
              </dl>
            )}
          </CardBody>
          <CardFooter className="justify-start">
            <Button
              size="sm"
              variant="secondary"
              iconStart={<RotateCw className="size-4" />}
              onClick={health.reload}
            >
              {t("api.reload")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              iconStart={<WifiOff className="size-4" />}
              onClick={() => setSimulateError(true)}
            >
              {t("api.simulateError")}
            </Button>
          </CardFooter>
        </Card>
      )}
    </GallerySection>
  );
}
