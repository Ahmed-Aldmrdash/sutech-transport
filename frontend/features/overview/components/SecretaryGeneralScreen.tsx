"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { AdminComplaintsScreen } from "@/features/complaints/components/AdminComplaintsScreen";
import { OverviewScreen } from "./OverviewScreen";

/** Read-only view for the secretary general's office: the day's numbers and every complaint with its reply. */
export function SecretaryGeneralScreen() {
  const t = useTranslations("admin.secretaryGeneral");
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <OverviewScreen compact />
      <h2 className="mt-6 mb-3 text-[20px] font-extrabold">{t("complaints")}</h2>
      <AdminComplaintsScreen readOnly embedded />
    </>
  );
}
