"use client";

import { FileBarChart } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { FilterChips } from "@/components/ui/filter-chips";
import { TextField } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { SelectField } from "@/components/ui/select-field";
import { Skeleton } from "@/components/ui/skeleton";
import { StatTile } from "@/components/ui/stat-tile";
import { Tone } from "@/components/ui/tone";
import { DeskPager } from "@/features/desk-kit/components/desk-pager";
import { listLines } from "@/features/lines/api";
import type { Locale } from "@/i18n/routing";
import { isApiError } from "@/lib/api/errors";
import { formatCalendarDate, formatDateTime } from "@/lib/format";
import { AsyncStatus, useAsync } from "@/lib/hooks/use-async";
import { getReport, listReports } from "../api";
import { ReportErrorCode, type ReportCatalog, type ReportType } from "../schema";
import { ExportButtons } from "./export-buttons";
import { ReportTable } from "./report-table";

const PAGE_SIZE = 50;
const ALL_LINES = "";
const KNOWN_ERRORS: readonly string[] = Object.values(ReportErrorCode);

function isKnownError(error: unknown): error is { code: ReportErrorCode } {
  return isApiError(error) && KNOWN_ERRORS.includes(error.code);
}

/** The office's reports: pick one, filter by line and period, read it, download it. */
export function ReportsPage() {
  const t = useTranslations("desk.reports");
  const catalog = useAsync((signal) => listReports({ signal }), []);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("lead")} />
      {catalog.status === AsyncStatus.Loading ? <Skeleton className="h-64 w-full" /> : null}
      {catalog.status === AsyncStatus.Error ? (
        <ErrorState error={catalog.error} onRetry={catalog.reload} />
      ) : null}
      {catalog.status === AsyncStatus.Success ? (
        catalog.data.items.length === 0 ? (
          <EmptyState icon={<FileBarChart />} title={t("none")} />
        ) : (
          <ReportView catalog={catalog.data} />
        )
      ) : null}
    </div>
  );
}

function ReportView({ catalog }: { catalog: ReportCatalog }) {
  const t = useTranslations("desk.reports");
  const locale = useLocale() as Locale;
  const first = catalog.items[0];
  const [type, setType] = useState<ReportType>(first?.type ?? "roster");
  const [lineId, setLineId] = useState(ALL_LINES);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const entry = catalog.items.find((item) => item.type === type) ?? first;
  const usesPeriod = entry?.uses_period ?? false;
  const filters = {
    line: lineId || undefined,
    from: usesPeriod && from ? from : undefined,
    to: usesPeriod && to ? to : undefined,
  };
  const lines = useAsync((signal) => listLines({ signal }), []);
  const report = useAsync(
    (signal) => getReport(type, { ...filters, page, page_size: PAGE_SIZE }, { signal }),
    [type, filters.line, filters.from, filters.to, page],
  );

  const line = lines.data?.find((item) => item.line_id === lineId) ?? null;

  return (
    <>
      <FilterChips
        label={t("pick")}
        value={type}
        onChange={(value) => {
          setType(value);
          setFrom("");
          setTo("");
          setPage(1);
        }}
        options={catalog.items.map((item) => ({ value: item.type, label: item.title }))}
      />
      {entry ? <p className="-mt-3 text-body-sm text-ink-muted">{entry.description}</p> : null}
      <Card>
        <CardBody className="grid gap-4 sm:grid-cols-3 sm:items-end">
          <SelectField
            label={t("line")}
            value={lineId}
            disabled={lines.status !== AsyncStatus.Success}
            options={[
              { value: ALL_LINES, label: t("allLines") },
              ...(lines.data ?? []).map((item) => ({
                value: item.line_id,
                label: t("lineOption", { code: item.code, name: item.name }),
              })),
            ]}
            onChange={(event) => {
              setLineId(event.target.value);
              setPage(1);
            }}
          />
          {usesPeriod ? (
            <>
              <TextField
                type="date"
                label={t("from")}
                value={from}
                max={to || undefined}
                onChange={(event) => {
                  setFrom(event.target.value);
                  setPage(1);
                }}
              />
              <TextField
                type="date"
                label={t("to")}
                value={to}
                min={from || undefined}
                onChange={(event) => {
                  setTo(event.target.value);
                  setPage(1);
                }}
              />
            </>
          ) : (
            <p className="text-body-sm text-ink-muted sm:col-span-2">{t("noPeriod")}</p>
          )}
        </CardBody>
      </Card>
      {report.status === AsyncStatus.Error ? (
        isKnownError(report.error) ? (
          <Alert tone={Tone.Warning} title={t(`errors.${report.error.code}`)} />
        ) : (
          <ErrorState error={report.error} onRetry={report.reload} />
        )
      ) : null}
      {report.status === AsyncStatus.Loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      ) : null}
      {report.status === AsyncStatus.Success ? (
        <section aria-labelledby="report-title" className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 desktop:flex-row desktop:items-start desktop:justify-between">
            <div>
              <h2 id="report-title" className="text-h3 text-ink-strong">
                {report.data.title}
              </h2>
              <p className="text-body-sm text-ink-muted">
                {[
                  report.data.filters.line
                    ? t("lineOption", {
                        code: report.data.filters.line.code,
                        name: report.data.filters.line.name,
                      })
                    : t("allLines"),
                  report.data.filters.from && report.data.filters.to
                    ? t("period", {
                        from: formatCalendarDate(report.data.filters.from, locale),
                        to: formatCalendarDate(report.data.filters.to, locale),
                      })
                    : null,
                  t("made", { time: formatDateTime(report.data.generated_at, locale) }),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <ExportButtons
              type={type}
              filters={filters}
              lineCode={line?.code ?? null}
              total={report.data.total}
            />
          </div>
          {report.data.summary.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 desktop:grid-cols-4">
              {report.data.summary.map((item) => (
                <StatTile key={item.label} label={item.label} value={item.value} />
              ))}
            </div>
          ) : null}
          <ReportTable report={report.data} />
          <DeskPager
            page={report.data.page}
            pageSize={report.data.page_size}
            total={report.data.total}
            onPage={setPage}
          />
        </section>
      ) : null}
    </>
  );
}
