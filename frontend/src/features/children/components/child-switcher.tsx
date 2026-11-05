"use client";

import { useTranslations } from "next-intl";
import { FilterChips } from "@/components/ui/filter-chips";
import { firstNameOf } from "@/features/auth/user-text";
import { useChildren } from "./children-provider";

/** Picks which child the page is about. Hidden when the guardian follows one student only. */
export function ChildSwitcher() {
  const t = useTranslations("parent");
  const { children, selected, select } = useChildren();
  if (children.length < 2 || !selected) return null;
  return (
    <FilterChips
      label={t("switchChild")}
      value={selected.student_id}
      onChange={select}
      options={children.map((child) => ({
        value: child.student_id,
        label: firstNameOf(child.name),
      }))}
    />
  );
}
