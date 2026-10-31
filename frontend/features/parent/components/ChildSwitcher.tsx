"use client";

import { useTranslations } from "next-intl";
import { Segmented } from "@/components/ui/Segmented";
import { useChildren } from "./ChildProvider";

/** Shown only when the parent has more than one child. */
export function ChildSwitcher() {
  const t = useTranslations("parent");
  const { query, selected, select } = useChildren();
  const list = query.data ?? [];
  if (list.length < 2 || !selected) return null;
  return (
    <div className="mb-4">
      <Segmented
        label={t("chooseChild")}
        value={selected.student_id}
        onChange={select}
        options={list.map((child) => ({ value: child.student_id, label: child.name.split(" ")[0] ?? child.name }))}
      />
    </div>
  );
}
