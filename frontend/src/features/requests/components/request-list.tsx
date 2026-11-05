"use client";

import { useLocale, useTranslations } from "next-intl";
import { List, ListItem } from "@/components/ui/list";
import type { Locale } from "@/i18n/routing";
import { formatCalendarDate, formatDate } from "@/lib/format";
import { RequestKind, type StudentRequest } from "../schema";
import { REQUEST_KIND_ICON } from "./request-kind-icon";
import { RequestStatusBadge } from "./request-status-badge";

/** One line that says what the request is about, e.g. "Line 5 → Line 12". */
export function useRequestTitle() {
  const t = useTranslations("student");
  const locale = useLocale() as Locale;
  return (request: StudentRequest): string => {
    switch (request.kind) {
      case RequestKind.LineChange:
        return t("requests.lineChange.summary", {
          from: t("lineCode", { code: request.details.from_line.code }),
          to: t("lineCode", { code: request.details.to_line.code }),
        });
      case RequestKind.Refund:
        return t("requests.refund.summary", {
          reason: t(`requests.refund.reasons.${request.details.reason}.label`),
        });
      case RequestKind.Complaint:
        return t(`requests.complaint.categories.${request.details.category}`);
      case RequestKind.ModelPermit:
        return t("requests.modelPermit.summary", {
          material: request.details.material,
          date: formatCalendarDate(request.details.entry_date, locale),
        });
    }
  };
}

/** The student's requests, newest first; each row opens the request. */
export function RequestList({
  requests,
  basePath,
}: {
  requests: readonly StudentRequest[];
  basePath: string;
}) {
  const t = useTranslations("student.requests");
  const locale = useLocale() as Locale;
  const titleOf = useRequestTitle();

  return (
    <List aria-label={t("listLabel")}>
      {requests.map((request) => {
        const Icon = REQUEST_KIND_ICON[request.kind];
        return (
          <ListItem
            key={request.request_id}
            href={`${basePath}/${request.request_id}`}
            icon={<Icon />}
            title={titleOf(request)}
            description={t("rowMeta", {
              kind: t(`kinds.${request.kind}`),
              reference: request.reference,
              date: formatDate(request.submitted_at, locale),
            })}
            trailing={<RequestStatusBadge status={request.status} />}
          />
        );
      })}
    </List>
  );
}
