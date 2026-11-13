"use client";

import { FileClock } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { Card, CardBody } from "@/components/ui/card";
import { FilterChips } from "@/components/ui/filter-chips";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/table";
import { DeskListState } from "@/features/desk-kit/components/desk-list-state";
import { DeskPager } from "@/features/desk-kit/components/desk-pager";
import { DeskSearch } from "@/features/desk-kit/components/desk-search";
import type { Locale } from "@/i18n/routing";
import { formatDateTime } from "@/lib/format";
import { useAsync } from "@/lib/hooks/use-async";
import { listAudit } from "../api";
import { AUDIT_AREAS, type AuditArea, type AuditLog } from "../schema";

const ALL = "all";
type AreaFilter = AuditArea | typeof ALL;

/** Every decision the offices took, newest first. Read only. */
export function AuditLogPage() {
  const t = useTranslations("desk.system.audit");
  const tRoot = useTranslations();
  const locale = useLocale() as Locale;
  const [area, setArea] = useState<AreaFilter>(ALL);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const state = useAsync(
    (signal) =>
      listAudit({ area: area === ALL ? undefined : area, q: q || undefined, page }, { signal }),
    [area, q, page],
  );
  const onSearch = useCallback((value: string) => {
    setQ(value);
    setPage(1);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("lead")} />
      <FilterChips
        label={t("areasLabel")}
        value={area}
        onChange={(value) => {
          setArea(value);
          setPage(1);
        }}
        options={[
          { value: ALL, label: t("areas.all") },
          ...AUDIT_AREAS.map((value) => ({ value, label: t(`areas.${value}`) })),
        ]}
      />
      <DeskSearch hint={t("searchHint")} onSearch={onSearch} />
      <DeskListState state={state}>
        {(log: AuditLog) => (
          <div className="flex flex-col gap-4">
            <ul className="flex flex-col gap-3 desktop:hidden" aria-label={t("caption")}>
              {log.items.length === 0 ? (
                <li className="text-body text-ink-muted">{t("empty")}</li>
              ) : null}
              {log.items.map((entry) => (
                <li key={entry.audit_id}>
                  <Card>
                    <CardBody className="flex flex-col gap-1">
                      <p className="text-body font-bold text-ink-strong">
                        {t(`actions.${entry.action}`)}
                      </p>
                      <p className="text-body-sm text-ink">
                        <bdi>{entry.target}</bdi>
                      </p>
                      {entry.detail ? (
                        <p className="text-body-sm text-ink-muted">
                          {t("note")}: {entry.detail}
                        </p>
                      ) : null}
                      <p className="text-caption text-ink-muted">
                        {entry.actor.name} · {tRoot(`roles.${entry.actor.role}`)} ·{" "}
                        <time dateTime={entry.at} className="tabular-nums">
                          {formatDateTime(entry.at, locale)}
                        </time>
                      </p>
                    </CardBody>
                  </Card>
                </li>
              ))}
            </ul>
            <DataTable
              className="hidden desktop:block"
              caption={t("caption")}
              rows={log.items}
              getRowKey={(entry) => entry.audit_id}
              empty={
                <p className="flex items-center gap-2 text-body text-ink-muted">
                  <FileClock aria-hidden="true" className="size-5" />
                  {t("empty")}
                </p>
              }
              columns={[
                {
                  key: "when",
                  header: t("when"),
                  className: "whitespace-nowrap",
                  cell: (entry) => (
                    <time dateTime={entry.at} className="tabular-nums">
                      {formatDateTime(entry.at, locale)}
                    </time>
                  ),
                },
                {
                  key: "who",
                  header: t("who"),
                  cell: (entry) => (
                    <span className="flex flex-col">
                      <span className="font-bold text-ink-strong">{entry.actor.name}</span>
                      <span className="text-caption text-ink-muted">
                        <bdi className="tabular-nums">{entry.actor.identifier}</bdi>
                        {" · "}
                        {tRoot(`roles.${entry.actor.role}`)}
                      </span>
                    </span>
                  ),
                },
                {
                  key: "what",
                  header: t("what"),
                  cell: (entry) => t(`actions.${entry.action}`),
                },
                {
                  key: "about",
                  header: t("about"),
                  cell: (entry) => (
                    <span className="flex flex-col">
                      <bdi>{entry.target}</bdi>
                      {entry.detail ? (
                        <span className="text-caption text-ink-muted">
                          {t("note")}: {entry.detail}
                        </span>
                      ) : null}
                    </span>
                  ),
                },
              ]}
            />
            <DeskPager
              page={log.page}
              pageSize={log.page_size}
              total={log.total}
              onPage={setPage}
            />
          </div>
        )}
      </DeskListState>
    </div>
  );
}
