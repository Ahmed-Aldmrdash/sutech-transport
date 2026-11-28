"use client";

import { UsersRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { SelectField } from "@/components/ui/select-field";
import { FilterChips } from "@/components/ui/filter-chips";
import { DataTable } from "@/components/ui/table";
import { DeskListState } from "@/features/desk-kit/components/desk-list-state";
import { DeskPager } from "@/features/desk-kit/components/desk-pager";
import { DeskSearch } from "@/features/desk-kit/components/desk-search";
import { StandingBadge } from "@/features/discipline/components/standing-badge";
import { STANDINGS, type Standing } from "@/features/discipline/schema";
import { Link } from "@/i18n/navigation";
import { AsyncStatus, useAsync } from "@/lib/hooks/use-async";
import { listOpsLines, listOpsStudents } from "../api";
import { RIDER_TYPES, type OpsStudents, type RiderType } from "../schema";
import { SubscriptionBadge } from "./subscription-badge";

/**
 * Every student and staff member with a seat this term (or a booking): search by ID or name,
 * filter by rider type, line or standing (warned, suspended, banned).
 */
export function StudentsPage() {
  const t = useTranslations("desk.ops.students");
  const tStanding = useTranslations("discipline.standing");
  const [q, setQ] = useState("");
  const [lineId, setLineId] = useState("");
  const [standing, setStanding] = useState<Standing | "">("");
  const [riderType, setRiderType] = useState<RiderType | "">("");
  const [page, setPage] = useState(1);
  const lines = useAsync((signal) => listOpsLines({ signal }), []);
  const state = useAsync(
    (signal) =>
      listOpsStudents(
        {
          q: q || undefined,
          line_id: lineId || undefined,
          standing: standing || undefined,
          rider_type: riderType || undefined,
          page,
        },
        { signal },
      ),
    [q, lineId, standing, riderType, page],
  );
  const onSearch = useCallback((value: string) => {
    setQ(value);
    setPage(1);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("lead")} />
      <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 desktop:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <DeskSearch hint={t("searchHint")} onSearch={onSearch} />
        <SelectField
          label={t("line")}
          value={lineId}
          containerClassName="w-full"
          onChange={(event) => {
            setLineId(event.target.value);
            setPage(1);
          }}
          options={[
            { value: "", label: t("allLines") },
            ...(lines.status === AsyncStatus.Success
              ? lines.data.items.map((item) => ({
                  value: item.line.line_id,
                  label: t("lineValue", { code: item.line.code, name: item.line.name }),
                }))
              : []),
          ]}
        />
        <SelectField
          label={t("standing")}
          value={standing}
          containerClassName="w-full"
          onChange={(event) => {
            setStanding(event.target.value as Standing | "");
            setPage(1);
          }}
          options={[
            { value: "", label: t("allStandings") },
            ...STANDINGS.map((value) => ({ value, label: tStanding(value) })),
          ]}
        />
      </div>
      <FilterChips<RiderType | "">
        label={t("riderType")}
        value={riderType}
        onChange={(next) => {
          setRiderType(next);
          setPage(1);
        }}
        options={[
          { value: "", label: t("allRiders") },
          ...RIDER_TYPES.map((value) => ({ value, label: t(`riderTypes.${value}`) })),
        ]}
      />
      <DeskListState state={state}>
        {(list: OpsStudents) => (
          <div className="flex flex-col gap-4">
            <DataTable
              caption={t("caption")}
              rows={list.items}
              getRowKey={(student) => student.student_id}
              empty={
                <p className="flex items-center gap-2 text-body text-ink-muted">
                  <UsersRound aria-hidden="true" className="size-5" />
                  {t("empty")}
                </p>
              }
              columns={[
                {
                  key: "name",
                  header: t("student"),
                  cell: (student) => (
                    <span className="flex flex-col">
                      <Link
                        href={`/admin/students/${student.student_id}`}
                        className="font-bold text-brand underline-offset-4 focus-ring hover:underline"
                      >
                        {student.name}
                      </Link>
                      <span className="flex flex-wrap items-center gap-2">
                        <bdi className="text-caption text-ink-muted tabular-nums">
                          {student.identifier}
                        </bdi>
                        {student.rider_type === "employee" ? <Badge>{t("employee")}</Badge> : null}
                        <StandingBadge standing={student.standing} />
                      </span>
                    </span>
                  ),
                },
                {
                  key: "line",
                  header: t("line"),
                  cell: (student) =>
                    student.line ? (
                      <span className="flex flex-col">
                        <span>
                          {t("lineValue", { code: student.line.code, name: student.line.name })}
                        </span>
                        <span className="text-caption text-ink-muted">{student.stop_name}</span>
                      </span>
                    ) : (
                      <Badge>{t("noLine")}</Badge>
                    ),
                },
                {
                  key: "status",
                  header: t("subscription"),
                  cell: (student) => <SubscriptionBadge status={student.subscription_status} />,
                },
              ]}
            />
            <DeskPager
              page={list.page}
              pageSize={list.page_size}
              total={list.total}
              onPage={setPage}
            />
          </div>
        )}
      </DeskListState>
    </div>
  );
}
