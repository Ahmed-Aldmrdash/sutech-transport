"use client";

import { CalendarDays } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChips } from "@/components/ui/filter-chips";
import { DeskListState } from "@/features/desk-kit/components/desk-list-state";
import { DeskPager } from "@/features/desk-kit/components/desk-pager";
import type { Locale } from "@/i18n/routing";
import { formatNumber } from "@/lib/format";
import { useAsync } from "@/lib/hooks/use-async";
import type { RequestOptions } from "@/lib/api/client";
import { EVENT_STATUSES, type EventStatus, type EventList, type EventListQuery } from "../schema";
import { EventRow } from "./event-parts";

const PAGE_SIZE = 10;
const ALL = "all";
type Filter = EventStatus | typeof ALL;

/** The event requests with a filter per status: the office's list and the company's. */
export function EventList({
  load,
  hrefOf,
  initialFilter = ALL,
}: {
  load: (query: EventListQuery, options?: RequestOptions) => Promise<EventList>;
  hrefOf: (eventId: string) => string;
  initialFilter?: Filter;
}) {
  const t = useTranslations("desk.events");
  const locale = useLocale() as Locale;
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [page, setPage] = useState(1);
  const state = useAsync(
    (signal) =>
      load({ status: filter === ALL ? undefined : filter, page, page_size: PAGE_SIZE }, { signal }),
    [filter, page],
  );
  const counts = state.data?.counts;
  const label = (status: EventStatus) =>
    counts
      ? `${t(`filters.${status}`)} (${formatNumber(counts[status], locale)})`
      : t(`filters.${status}`);

  return (
    <div className="flex flex-col gap-4">
      <FilterChips
        label={t("filters.label")}
        value={filter}
        onChange={(value) => {
          setFilter(value);
          setPage(1);
        }}
        options={[
          { value: ALL, label: t("filters.all") },
          ...EVENT_STATUSES.map((status) => ({ value: status, label: label(status) })),
        ]}
      />
      <DeskListState state={state}>
        {(data: EventList) =>
          data.items.length === 0 ? (
            <EmptyState icon={<CalendarDays />} title={t(`empty.${filter}`)} />
          ) : (
            <>
              <ul className="flex flex-col gap-3">
                {data.items.map((event) => (
                  <li key={event.event_id}>
                    <EventRow event={event} href={hrefOf(event.event_id)} />
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
