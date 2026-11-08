import { setRequestLocale } from "next-intl/server";
import { EmergencyDetailPage } from "@/features/emergencies/components/emergency-detail-page";
import type { Locale } from "@/i18n/routing";
import { pageTitle } from "@/i18n/page-title";

export const generateMetadata = pageTitle("nav.items.emergencies");

export default async function Page({ params }: PageProps<"/[locale]/admin/emergencies/[sosId]">) {
  const { locale, sosId } = await params;
  setRequestLocale(locale as Locale);
  return <EmergencyDetailPage sosId={decodeURIComponent(sosId)} />;
}
