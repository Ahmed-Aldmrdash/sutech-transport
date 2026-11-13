import { setRequestLocale } from "next-intl/server";
import { ViolationsDeskPage } from "@/features/violation-desk/components/violations-desk-page";
import type { Locale } from "@/i18n/routing";
import { pageTitle } from "@/i18n/page-title";

export const generateMetadata = pageTitle("nav.items.violations");

export default async function Page({ params }: PageProps<"/[locale]/admin/violations">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <ViolationsDeskPage />;
}
