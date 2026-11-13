"use client";

import { Inbox } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChips } from "@/components/ui/filter-chips";
import { PageHeader } from "@/components/ui/page-header";
import { DeskListState } from "@/features/desk-kit/components/desk-list-state";
import { DeskPager } from "@/features/desk-kit/components/desk-pager";
import { DeskRow } from "@/features/desk-kit/components/desk-row";
import { DeskSearch } from "@/features/desk-kit/components/desk-search";
import { REQUEST_KIND_ICON } from "@/features/requests/components/request-kind-icon";
import type { Locale } from "@/i18n/routing";
import { formatDateTime, formatNumber } from "@/lib/format";
import { useAsync } from "@/lib/hooks/use-async";
import { listDeskRequests } from "../api";
import { DeskStage, type DeskRequestList, type DeskRequestSummary } from "../schema";
import { SECTION_KINDS, sectionHref, type DeskSection } from "./desk-sections";
import { StageBadge } from "./stage-badge";

const PAGE_SIZE = 20;
const ALL = "all";
type Filter = DeskStage | typeof ALL;
const STAGES = [DeskStage.New, DeskStage.InReview, DeskStage.Closed] as const;

/** An office's queue of student requests: new first, then the ones being worked on. */
export function RequestDeskPage({ section }: { section: DeskSection }) {
  const t = useTranslations("desk.requests");
  const locale = useLocale() as Locale;
  const [filter, setFilter] = useState<Filter>(DeskStage.New);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const state = useAsync(
    (signal) =>
      listDeskRequests(
        {
          kind: SECTION_KINDS[section],
          stage: filter === ALL ? undefined : filter,
          q: query || undefined,
          page,
          page_size: PAGE_SIZE,
        },
        { signal },
      ),
    [section, filter, query, page],
  );
  const onSearch = useCallback((value: string) => {
    setQuery(value);
    setPage(1);
  }, []);
  const counts = state.data?.counts;
  const label = (stage: DeskStage) =>
    counts
      ? `${t(`filters.${stage}`)} (${formatNumber(counts[stage], locale)})`
      : t(`filters.${stage}`);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t(`sections.${section}.title`)}
        description={t(`sections.${section}.lead`)}
      />
      <div className="flex flex-col gap-4 desktop:flex-row desktop:items-end desktop:justify-between">
        <FilterChips
          label={t("filters.label")}
          value={filter}
          onChange={(value) => {
            setFilter(value);
            setPage(1);
          }}
          options={[
            ...STAGES.map((stage) => ({ value: stage, label: label(stage) })),
            { value: ALL, label: t("filters.all") },
          ]}
        />
        <DeskSearch hint={t("searchHint")} onSearch={onSearch} />
      </div>
      <DeskListState state={state}>
        {(data: DeskRequestList) =>
          data.items.length === 0 ? (
            <EmptyState
              icon={<Inbox />}
              title={query ? t("empty.searchTitle") : t(`empty.${filter}`)}
              description={query ? t("empty.searchBody") : undefined}
            />
          ) : (
            <>
              <ul className="flex flex-col gap-3">
                {data.items.map((item) => (
                  <li key={item.request_id}>
                    <RequestRow section={section} item={item} />
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

function RequestRow({ section, item }: { section: DeskSection; item: DeskRequestSummary }) {
  const t = useTranslations("desk.requests");
  const locale = useLocale() as Locale;
  const Icon = REQUEST_KIND_ICON[item.kind];
  return (
    <DeskRow
      href={sectionHref(section, item.request_id)}
      icon={<Icon />}
      title={item.title}
      badge={<StageBadge stage={item.stage} />}
      highlight={item.stage === DeskStage.New}
      muted={item.stage === DeskStage.Closed}
      lines={[
        <>
          {item.student.name} · <bdi>{item.student.identifier}</bdi>
        </>,
        [
          t(`kinds.${item.kind}`),
          item.reference,
          t("row.received", { time: formatDateTime(item.received_at, locale) }),
          item.handled_by_name ? t("row.by", { name: item.handled_by_name }) : null,
        ]
          .filter(Boolean)
          .join(" · "),
      ]}
    />
  );
}
