"use client";

import { useLocale, useTranslations } from "next-intl";
import { type ReactNode } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { Locale } from "@/i18n/routing";
import { formatCalendarDate, formatClockTime, formatDateTime, formatMoney } from "@/lib/format";
import { RequestKind, type StudentRequest } from "../schema";
import { Row, Attachments } from "./request-detail-parts";

/** What the student asked for, field by field. */
export function RequestDetails({
  request,
  title,
}: {
  request: StudentRequest;
  /** The card's heading; "What you sent" on the student's own page. */
  title?: string;
}) {
  const t = useTranslations("student");
  const locale = useLocale() as Locale;
  const lineLabel = (line: { code: string; name: string }) =>
    `${t("lineCode", { code: line.code })} · ${line.name}`;
  const day = (value: string) => formatCalendarDate(value, locale);

  let rows: ReactNode;
  switch (request.kind) {
    case RequestKind.LineChange: {
      const details = request.details;
      rows = (
        <>
          <Row label={t("requests.lineChange.fromLine")}>{lineLabel(details.from_line)}</Row>
          <Row label={t("requests.lineChange.toLine")}>{lineLabel(details.to_line)}</Row>
          <Row label={t("requests.lineChange.toStop")}>{details.to_stop.name}</Row>
          <Row label={t("requests.lineChange.duration")}>
            {details.ends_on
              ? t("requests.lineChange.temporaryRange", {
                  from: day(details.starts_on),
                  to: day(details.ends_on),
                })
              : t("requests.lineChange.permanentFrom", { from: day(details.starts_on) })}
          </Row>
          <Row label={t("requests.lineChange.reason")}>{details.reason}</Row>
          <Row label={t("requests.lineChange.studentPhone")}>
            <span dir="ltr">{details.student_phone}</span>
          </Row>
          <Row label={t("requests.guardian.name")}>{details.guardian_name}</Row>
          <Row label={t("requests.guardian.phone")}>
            <span dir="ltr">{details.guardian_phone}</span>
          </Row>
        </>
      );
      break;
    }
    case RequestKind.Refund: {
      const details = request.details;
      rows = (
        <>
          <Row label={t("requests.refund.reason")}>
            {t(`requests.refund.reasons.${details.reason}.label`)}
          </Row>
          <Row label={t("requests.refund.explanation")}>{details.explanation}</Row>
          <Row label={t("requests.refund.paid")}>{formatMoney(details.paid_piasters, locale)}</Row>
          <Row label={t("requests.refund.deduction")}>
            {t("requests.refund.percent", { percent: details.deduction_percent })}
          </Row>
          <Row label={t("requests.refund.estimate")}>
            {details.estimated_refund_piasters === null
              ? t("requests.refund.decidedByUniversity")
              : formatMoney(details.estimated_refund_piasters, locale)}
          </Row>
          {details.approved_refund_piasters === null ? null : (
            <Row label={t("requests.refund.approvedAmount")}>
              {formatMoney(details.approved_refund_piasters, locale)}
            </Row>
          )}
          <Row label={t("requests.guardian.name")}>{details.guardian_name}</Row>
          <Row label={t("requests.guardian.phone")}>
            <span dir="ltr">{details.guardian_phone}</span>
          </Row>
          {details.attachments.length > 0 ? (
            <Row label={t("requests.refund.documents")}>
              <Attachments items={details.attachments} />
            </Row>
          ) : null}
        </>
      );
      break;
    }
    case RequestKind.Complaint: {
      const details = request.details;
      rows = (
        <>
          <Row label={t("requests.complaint.category")}>
            {t(`requests.complaint.categories.${details.category}`)}
          </Row>
          <Row label={t("requests.complaint.line")}>
            {details.line ? lineLabel(details.line) : t("requests.complaint.noLine")}
          </Row>
          <Row label={t("requests.complaint.happenedOn")}>{day(details.happened_on)}</Row>
          <Row label={t("requests.complaint.description")}>{details.description}</Row>
          {details.attachments.length > 0 ? (
            <Row label={t("requests.complaint.attachments")}>
              <Attachments items={details.attachments} />
            </Row>
          ) : null}
        </>
      );
      break;
    }
    case RequestKind.ModelPermit: {
      const details = request.details;
      const p = "requests.modelPermit";
      const moment = (date: string, time: string) =>
        t(`${p}.moment`, { date: day(date), time: formatClockTime(time, locale) });
      rows = (
        <>
          <Row label={t(`${p}.studentName`)}>{details.student_name}</Row>
          <Row label={t(`${p}.universityId`)}>
            <span dir="ltr">{details.university_id}</span>
          </Row>
          {details.faculty ? <Row label={t(`${p}.faculty`)}>{details.faculty}</Row> : null}
          {details.level ? (
            <Row label={t(`${p}.level`)}>{t(`${p}.levelValue`, { level: details.level })}</Row>
          ) : null}
          <Row label={t(`${p}.line`)}>{lineLabel(details.line)}</Row>
          <Row label={t(`${p}.busType`)}>{t(`busType.${details.bus_type}`)}</Row>
          <Row label={t(`${p}.driver`)}>
            {details.driver_name ? (
              <>
                {details.driver_name}
                {details.driver_phone ? (
                  <>
                    {" · "}
                    <span dir="ltr">{details.driver_phone}</span>
                  </>
                ) : null}
              </>
            ) : (
              t(`${p}.driverPending`)
            )}
          </Row>
          <Row label={t(`${p}.material`)}>{details.material}</Row>
          <Row label={t(`${p}.dimensions`)}>{details.dimensions}</Row>
          <Row label={t(`${p}.purpose`)}>
            {details.purpose_other
              ? `${t(`${p}.purposes.${details.purpose}`)}: ${details.purpose_other}`
              : t(`${p}.purposes.${details.purpose}`)}
          </Row>
          <Row label={t(`${p}.destination`)}>{details.destination}</Row>
          <Row label={t(`${p}.entry`)}>{moment(details.entry_date, details.entry_time)}</Row>
          <Row label={t(`${p}.exit`)}>{moment(details.exit_date, details.exit_time)}</Row>
          <Row label={t(`${p}.supervisorName`)}>{details.supervisor_name}</Row>
          <Row label={t(`${p}.declarationTitle`)}>{t(`${p}.declarationAccepted`)}</Row>
        </>
      );
      break;
    }
  }

  return (
    <Card>
      <CardHeader title={title ?? t("requests.detail.detailsTitle")} />
      <CardBody>
        <dl className="flex flex-col divide-y divide-line">
          <Row label={t("requests.detail.submittedAt")}>
            {formatDateTime(request.submitted_at, locale)}
          </Row>
          {rows}
        </dl>
      </CardBody>
    </Card>
  );
}
