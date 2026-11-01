"use client";

import { Route } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Switch } from "@/components/ui/choice";
import { EmptyState } from "@/components/ui/empty-state";
import { SampleLinesTable } from "../sample-lines";
import { GallerySection } from "./gallery-section";

export function TableSection() {
  const t = useTranslations("gallery");
  const [isLoading, setIsLoading] = useState(false);
  const [isEmpty, setIsEmpty] = useState(false);

  return (
    <GallerySection id="tables" title={t("sections.tables")}>
      <div className="mb-3 flex flex-wrap gap-x-8">
        <Switch
          label={t("tables.showLoading")}
          checked={isLoading}
          onChange={(event) => setIsLoading(event.target.checked)}
        />
        <Switch
          label={t("tables.showEmpty")}
          checked={isEmpty}
          onChange={(event) => setIsEmpty(event.target.checked)}
        />
      </div>
      <SampleLinesTable
        isLoading={isLoading}
        rows={isEmpty ? [] : undefined}
        empty={
          <EmptyState
            icon={<Route />}
            title={t("tables.emptyTitle")}
            description={t("tables.emptyBody")}
          />
        }
      />
    </GallerySection>
  );
}
