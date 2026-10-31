"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { useCanEdit } from "@/components/layout/RequirePage";
import { Async } from "@/components/ui/Async";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { listLines } from "@/features/lines/api";
import { combineQueries, useApi } from "@/lib/api/use-api";
import { listBuses } from "../api";
import { LineEditor } from "./LineEditor";
import { NewLineForm } from "./NewLineForm";

export function AdminLinesScreen() {
  const t = useTranslations("admin.lines");
  const canEdit = useCanEdit();
  const query = combineQueries(useApi(listLines), useApi(listBuses));
  const [creating, setCreating] = useState(false);
  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={canEdit && <Button size="sm" icon={<Plus className="size-4" aria-hidden />} onClick={() => setCreating(true)}>{t("new")}</Button>}
      />
      <Async query={query}>
        {([lines, buses]) => (
          <>
            <div className="grid gap-4 lg:grid-cols-2">
              {lines.items.map((line) => (
                <LineEditor key={line.id} line={line} canEdit={canEdit} />
              ))}
            </div>
            <Dialog open={creating} onClose={() => setCreating(false)} title={t("new")}>
              <NewLineForm buses={buses} onDone={() => setCreating(false)} />
            </Dialog>
          </>
        )}
      </Async>
    </>
  );
}
