"use client";

import { CalendarX2, CircleCheck, ClipboardList, GraduationCap, MapPin, UserX } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { BackLink } from "@/components/ui/back-link";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { DeskListState } from "@/features/desk-kit/components/desk-list-state";
import { DeskRow } from "@/features/desk-kit/components/desk-row";
import { CallLink, Fact } from "@/features/emergencies/components/sos-facts";
import { RequestKind } from "@/features/requests/schema";
import type { Locale } from "@/i18n/routing";
import { formatClockTime, formatDateTime, formatNumber } from "@/lib/format";
import { useAsync } from "@/lib/hooks/use-async";
import { getOpsStudent } from "../api";
import type { OpsStudentDetail } from "../schema";
import { SubscriptionBadge } from "./subscription-badge";

/** One student for the Transportation office: who to call, their seat, trips and requests. */
export function StudentDetailPage({ studentId }: { studentId: string }) {
  const t = useTranslations("desk.ops.students");
  const state = useAsync((signal) => getOpsStudent(studentId, { signal }), [studentId]);
  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/admin/students">{t("back")}</BackLink>
      <DeskListState state={state}>
        {(student: OpsStudentDetail) => <StudentDetail student={student} />}
      </DeskListState>
    </div>
  );
}

function StudentDetail({ student }: { student: OpsStudentDetail }) {
  const t = useTranslations("desk.ops.students");
  const locale = useLocale() as Locale;
  const number = (value: number) => formatNumber(value, locale);
  return (
    <>
      <PageHeader
        title={student.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <bdi className="tabular-nums">{student.identifier}</bdi>
            <SubscriptionBadge status={student.subscription_status} />
          </span>
        }
      />
      <Card elevation="raised">
        <CardBody>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Fact label={t("seat")} icon={<MapPin />}>
              {student.line
                ? [
                    t("lineValue", { code: student.line.code, name: student.line.name }),
                    student.stop_name,
                    student.pickup_time ? formatClockTime(student.pickup_time, locale) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : t("noLine")}
            </Fact>
            <Fact label={t("faculty")} icon={<GraduationCap />}>
              {student.faculty
                ? student.level
                  ? t("facultyLevel", { faculty: student.faculty, level: number(student.level) })
                  : student.faculty
                : "—"}
            </Fact>
            <Fact label={t("phone")}>
              {student.phone ? <CallLink name={student.name} phone={student.phone} /> : "—"}
            </Fact>
            <Fact label={t("guardian")}>
              {student.guardian ? (
                <span className="flex flex-col items-start gap-1">
                  {student.guardian.phone ? (
                    <CallLink name={student.guardian.name} phone={student.guardian.phone} />
                  ) : (
                    student.guardian.name
                  )}
                  <Badge>{student.guardian.has_account ? t("hasApp") : t("noApp")}</Badge>
                </span>
              ) : (
                "—"
              )}
            </Fact>
          </dl>
        </CardBody>
      </Card>
      <section aria-labelledby="student-trips" className="flex flex-col gap-3">
        <h2 id="student-trips" className="text-h3 text-ink-strong">
          {t("tripsTitle")}
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <StatTile label={t("rode")} value={number(student.trips.rode)} icon={<CircleCheck />} />
          <StatTile
            label={t("notGoing")}
            value={number(student.trips.not_going)}
            icon={<CalendarX2 />}
          />
          <StatTile label={t("absent")} value={number(student.trips.absent)} icon={<UserX />} />
        </div>
      </section>
      <Requests student={student} />
    </>
  );
}

function Requests({ student }: { student: OpsStudentDetail }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  if (student.requests.length === 0) {
    return (
      <Card>
        <CardHeader title={t("desk.ops.students.requestsTitle")} headingLevel={2} />
        <CardBody>
          <p className="text-body text-ink-muted">{t("desk.ops.students.noRequests")}</p>
        </CardBody>
      </Card>
    );
  }
  return (
    <section aria-labelledby="student-requests" className="flex flex-col gap-3">
      <h2 id="student-requests" className="text-h3 text-ink-strong">
        {t("desk.ops.students.requestsTitle")}
      </h2>
      <ul className="flex flex-col gap-3">
        {student.requests.map((request) => {
          const lines = [
            [
              request.reference,
              formatDateTime(request.received_at, locale),
              request.handled_here ? null : t("desk.ops.students.financeHandles"),
            ]
              .filter(Boolean)
              .join(" · "),
          ];
          const title = t(`student.requests.kinds.${request.kind}`);
          const badge = <Badge>{t(`student.requests.status.${request.status}`)}</Badge>;
          return (
            <li key={request.request_id}>
              {request.handled_here ? (
                <DeskRow
                  href={`/admin/${request.kind === RequestKind.Complaint ? "complaints" : "requests"}/${request.request_id}`}
                  icon={<ClipboardList />}
                  title={title}
                  badge={badge}
                  lines={lines}
                />
              ) : (
                <Card className="flex items-center gap-4 p-4">
                  <span className="flex flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-body font-bold text-ink-strong">{title}</span>
                      {badge}
                    </span>
                    <span className="text-body-sm text-ink-muted">{lines[0]}</span>
                  </span>
                </Card>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
