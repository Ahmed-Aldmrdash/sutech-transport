import { setRequestLocale } from "next-intl/server";
import { FleetPage } from "@/features/event-buses/components/fleet-page";
import type { Locale } from "@/i18n/routing";
import { pageTitle } from "@/i18n/page-title";

export const generateMetadata = pageTitle("desk.company.fleet.title");

export default async function Page({ params }: PageProps<"/[locale]/admin/bus-company/fleet">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <FleetPage />;
}
