"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { Async } from "@/components/ui/Async";
import { Button } from "@/components/ui/Button";
import { type Column, Table } from "@/components/ui/Table";
import { useApi } from "@/lib/api/use-api";
import { formatDateTime } from "@/lib/time";
import { getAudit } from "../api";
import type { AuditEntry } from "../schema";

const PAGE_SIZE = 50;

/** Who did what and when. Read-only; the server writes it on every change. */
export function AuditScreen() {
  const t = useTranslations("admin.audit");
  const locale = useLocale();
  const [page, setPage] = useState(1);
  const query = useApi(() => getAudit(page, PAGE_SIZE), [page]);
  const columns: Column<AuditEntry>[] = [
    { key: "at", header: t("at"), cell: (row) => <span className="text-[13px] whitespace-nowrap">{formatDateTime(row.at, locale)}</span> },
    { key: "actor", header: t("actor"), cell: (row) => <span className="font-bold">{row.actor}</span> },
    { key: "action", header: t("action"), cell: (row) => row.action },
  ];
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <Async query={query}>
        {(data) => {
          const pages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
          return (
            <div className="flex flex-col gap-3">
              <Table rows={data.items} columns={columns} rowKey={(row, index) => `${row.at}-${index}`} caption={t("title")} empty={t("empty")} />
              <div className="flex items-center justify-between gap-2">
                <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
                  {t("previous")}
                </Button>
                <span className="num text-[14px] text-ink-muted">{t("page", { page, pages })}</span>
                <Button size="sm" variant="ghost" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>
                  {t("next")}
                </Button>
              </div>
            </div>
          );
        }}
      </Async>
    </>
  );
}
