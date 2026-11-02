"use client";

import { Search, SearchX } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/choice";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { TextField } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Tone } from "@/components/ui/tone";
import { getMySubscription } from "@/features/subscriptions/api";
import { BOOKABLE_STATUSES } from "@/features/subscriptions/schema";
import type { Locale } from "@/i18n/routing";
import { formatClockTime, formatMoney } from "@/lib/format";
import { AsyncStatus, useAsync } from "@/lib/hooks/use-async";
import { listLines } from "../api";
import type { Line } from "../schema";
import { LineCard, lineHref } from "./line-card";
import { matchesLineSearch } from "./line-search";

const SKELETON_CARDS = 6;

/** Every line open this term, searchable, with seats and price; opens a line to book. */
export function LinesPage() {
  const t = useTranslations();
  const [query, setQuery] = useState("");
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const lines = useAsync((signal) => listLines({ signal }), []);
  const mine = useAsync((signal) => getMySubscription({ signal }), []);

  const visible = useMemo(
    () =>
      lines.status === AsyncStatus.Success
        ? lines.data.filter(
            (line) =>
              matchesLineSearch(line, query) && (!onlyAvailable || line.seats_available > 0),
          )
        : [],
    [lines.status, lines.data, query, onlyAvailable],
  );

  const booking = mine.status === AsyncStatus.Success ? mine.data.subscription : null;
  const hasOpenBooking = booking !== null && !BOOKABLE_STATUSES.includes(booking.status);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("nav.items.lines")}
        description={lines.status === AsyncStatus.Success ? <LinesLead lines={lines.data} /> : null}
      />
      {hasOpenBooking ? (
        <Alert
          tone={Tone.Info}
          title={t("student.lines.alreadyBooked", { line: booking.line.name })}
          action={
            <ButtonLink href={lineHref(booking.line.line_id)} variant="secondary" size="sm">
              {t("student.lines.openBooking")}
            </ButtonLink>
          }
        />
      ) : null}
      <div className="flex flex-col gap-3 desktop:flex-row desktop:items-end">
        <TextField
          label={t("student.lines.searchLabel")}
          placeholder={t("student.lines.searchPlaceholder")}
          type="search"
          icon={<Search />}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          containerClassName="desktop:max-w-md desktop:flex-1"
        />
        <Checkbox
          label={t("student.lines.onlyAvailable")}
          checked={onlyAvailable}
          onChange={(event) => setOnlyAvailable(event.target.checked)}
          className="desktop:mb-3"
        />
      </div>

      {lines.status === AsyncStatus.Loading ? (
        <div className="grid gap-4 sm:grid-cols-2 desktop:grid-cols-3">
          {Array.from({ length: SKELETON_CARDS }, (_, index) => (
            <Skeleton key={index} className="h-40" />
          ))}
        </div>
      ) : null}
      {lines.status === AsyncStatus.Error ? (
        <ErrorState error={lines.error} onRetry={lines.reload} />
      ) : null}
      {lines.status === AsyncStatus.Success ? (
        <>
          <p className="text-body-sm text-ink-muted" aria-live="polite">
            {t("student.lines.count", { count: visible.length })}
          </p>
          {visible.length > 0 ? (
            <ul className="grid gap-4 sm:grid-cols-2 desktop:grid-cols-3">
              {visible.map((line) => (
                <LineCard key={line.line_id} line={line} />
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<SearchX />}
              title={t("student.lines.noResultsTitle")}
              description={t("student.lines.noResultsBody")}
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQuery("");
                    setOnlyAvailable(false);
                  }}
                >
                  {t("student.lines.clearSearch")}
                </Button>
              }
            />
          )}
          <p className="text-caption text-ink-muted">{t("student.lines.estimateNote")}</p>
        </>
      ) : null}
    </div>
  );
}

function LinesLead({ lines }: { lines: Line[] }) {
  const t = useTranslations("student.lines");
  const locale = useLocale() as Locale;
  const sample = lines[0];
  if (!sample) return null;
  return t("lead", {
    price: formatMoney(sample.price_piasters, locale),
    from: formatClockTime(sample.campus_arrival.from, locale),
    to: formatClockTime(sample.campus_arrival.to, locale),
  });
}
