"use client";

import { ShieldAlert } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChips } from "@/components/ui/filter-chips";
import { PageHeader } from "@/components/ui/page-header";
import { SelectField } from "@/components/ui/select-field";
import { DeskListState } from "@/features/desk-kit/components/desk-list-state";
import { DeskPager } from "@/features/desk-kit/components/desk-pager";
import { DeskRow } from "@/features/desk-kit/components/desk-row";
import { DeskSearch } from "@/features/desk-kit/components/desk-search";
import { CONDUCT_RULES, ViolationStatus, type ConductRule } from "@/features/violations/schema";
import type { Locale } from "@/i18n/routing";
import { formatDateTime, formatNumber } from "@/lib/format";
import { useAsync } from "@/lib/hooks/use-async";
import { listDeskViolations } from "../api";
import type { DeskViolation, DeskViolationList } from "../schema";
import { ViolationBadge } from "./violation-badge";

const PAGE_SIZE = 20;
const ALL = "all";
type Filter = ViolationStatus | typeof ALL;
const STATUSES = [
  ViolationStatus.Submitted,
  ViolationStatus.UnderReview,
  ViolationStatus.Closed,
] as const;

/** What the crews reported: new first. Student Affairs decides; Transportation follows. */
export function ViolationsDeskPage() {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const [filter, setFilter] = useState<Filter>(ViolationStatus.Submitted);
  const [rule, setRule] = useState<ConductRule | "">("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const state = useAsync(
    (signal) =>
      listDeskViolations(
        {
          status: filter === ALL ? undefined : filter,
          rule: rule || undefined,
          q: query || undefined,
          page,
          page_size: PAGE_SIZE,
        },
        { signal },
      ),
    [filter, rule, query, page],
  );
  const onSearch = useCallback((value: string) => {
    setQuery(value);
    setPage(1);
  }, []);
  const counts = state.data?.counts;
  const label = (status: ViolationStatus) =>
    counts
      ? `${t(`desk.violations.filters.${status}`)} (${formatNumber(counts[status], locale)})`
      : t(`desk.violations.filters.${status}`);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("desk.violations.title")} description={t("desk.violations.lead")} />
      <FilterChips
        label={t("desk.violations.filters.label")}
        value={filter}
        onChange={(value) => {
          setFilter(value);
          setPage(1);
        }}
        options={[
          ...STATUSES.map((status) => ({ value: status, label: label(status) })),
          { value: ALL, label: t("desk.violations.filters.all") },
        ]}
      />
      <div className="grid grid-cols-1 gap-4 desktop:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] desktop:items-end">
        <DeskSearch hint={t("desk.violations.searchHint")} onSearch={onSearch} />
        <SelectField
          label={t("desk.violations.rule")}
          value={rule}
          placeholder={t("desk.violations.allRules")}
          options={CONDUCT_RULES.map((item) => ({
            value: item,
            label: t(`violations.rules.${item}`),
          }))}
          onChange={(event) => {
            setRule(event.target.value as ConductRule | "");
            setPage(1);
          }}
        />
      </div>
      <DeskListState state={state}>
        {(data: DeskViolationList) =>
          data.items.length === 0 ? (
            <EmptyState
              icon={<ShieldAlert />}
              title={
                query || rule
                  ? t("desk.violations.empty.searchTitle")
                  : t(`desk.violations.empty.${filter}`)
              }
            />
          ) : (
            <>
              <ul className="flex flex-col gap-3">
                {data.items.map((item) => (
                  <li key={item.violation_id}>
                    <ViolationRow item={item} />
                  </li>
                ))}
              </ul>
              <DeskPager page={page} pageSize={PAGE_SIZE} total={data.total} onPage={setPage} />
            </>
          )
        }
      </DeskListState>
    </div>
  );
}

function ViolationRow({ item }: { item: DeskViolation }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  return (
    <DeskRow
      href={`/admin/violations/${encodeURIComponent(item.violation_id)}`}
      icon={<ShieldAlert />}
      title={t(`violations.rules.${item.rule}`)}
      badge={<ViolationBadge status={item.status} />}
      highlight={item.status === ViolationStatus.Submitted}
      muted={item.status === ViolationStatus.Closed}
      lines={[
        item.student ? (
          <>
            {item.student.name} · <bdi>{item.student.identifier}</bdi>
          </>
        ) : (
          t("desk.violations.unknownStudent")
        ),
        [
          item.line
            ? t("desk.violations.lineValue", { code: item.line.code, name: item.line.name })
            : null,
          t("desk.violations.reportedBy", {
            name: item.reported_by.name,
            role: t(`roles.${item.reported_by.role}`),
          }),
          formatDateTime(item.created_at, locale),
        ]
          .filter(Boolean)
          .join(" · "),
      ]}
    />
  );
}
