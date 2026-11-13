import { setRequestLocale } from "next-intl/server";
import { ReportsPage } from "@/features/reports/components/reports-page";
import type { Locale } from "@/i18n/routing";
import { pageTitle } from "@/i18n/page-title";

export const generateMetadata = pageTitle("nav.items.reports");

export default async function Page({ params }: PageProps<"/[locale]/admin/reports">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <ReportsPage />;
}
