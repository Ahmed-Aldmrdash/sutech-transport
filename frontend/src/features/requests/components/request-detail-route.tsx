"use client";

import { useTranslations } from "next-intl";
import { RequestDetailPage } from "./request-detail-page";
import { COMPLAINTS_PATH, REQUESTS_PATH } from "./requests-page";

/** The detail page, with "back" pointing at the list it was opened from. */
export function RequestDetailRoute({
  requestId,
  list,
}: {
  requestId: string;
  list: "requests" | "complaints";
}) {
  const t = useTranslations("student.requests");
  return list === "requests" ? (
    <RequestDetailPage requestId={requestId} backHref={REQUESTS_PATH} backLabel={t("title")} />
  ) : (
    <RequestDetailPage
      requestId={requestId}
      backHref={COMPLAINTS_PATH}
      backLabel={t("complaint.title")}
    />
  );
}
