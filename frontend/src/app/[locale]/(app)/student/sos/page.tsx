import { setRequestLocale } from "next-intl/server";
import { RiderSosPage } from "@/features/sos/components/rider-sos-page";
import type { Locale } from "@/i18n/routing";
import { pageTitle } from "@/i18n/page-title";

export const generateMetadata = pageTitle("nav.items.sos");

export default async function Page({ params }: PageProps<"/[locale]/student/sos">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <RiderSosPage />;
}
