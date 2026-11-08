import { setRequestLocale } from "next-intl/server";
import { SosPage } from "@/features/sos/components/sos-page";
import type { Locale } from "@/i18n/routing";
import { pageTitle } from "@/i18n/page-title";

export const generateMetadata = pageTitle("nav.items.sos");

export default async function Page({ params }: PageProps<"/[locale]/driver/sos">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <SosPage />;
}
