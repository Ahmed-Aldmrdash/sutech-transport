import { setRequestLocale } from "next-intl/server";
import { ViolationDeskDetail } from "@/features/violation-desk/components/violation-desk-detail";
import type { Locale } from "@/i18n/routing";
import { pageTitle } from "@/i18n/page-title";

export const generateMetadata = pageTitle("nav.items.violations");

export default async function Page({
  params,
}: PageProps<"/[locale]/admin/violations/[violationId]">) {
  const { locale, violationId } = await params;
  setRequestLocale(locale as Locale);
  return <ViolationDeskDetail violationId={decodeURIComponent(violationId)} />;
}
