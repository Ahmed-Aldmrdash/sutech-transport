import { setRequestLocale } from "next-intl/server";
import { ScanPage } from "@/features/crew/components/scan-page";
import type { Locale } from "@/i18n/routing";
import { pageTitle } from "@/i18n/page-title";

export const generateMetadata = pageTitle("nav.items.scan");

export default async function Page({ params }: PageProps<"/[locale]/driver/scan">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <ScanPage />;
}
