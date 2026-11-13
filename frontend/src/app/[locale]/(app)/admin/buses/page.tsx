import { setRequestLocale } from "next-intl/server";
import { BusesPage } from "@/features/ops-desk/components/buses-page";
import type { Locale } from "@/i18n/routing";
import { pageTitle } from "@/i18n/page-title";

export const generateMetadata = pageTitle("desk.ops.buses.title");

export default async function Page({ params }: PageProps<"/[locale]/admin/buses">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <BusesPage />;
}
