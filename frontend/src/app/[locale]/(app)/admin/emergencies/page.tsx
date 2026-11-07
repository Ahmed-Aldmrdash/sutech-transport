import { setRequestLocale } from "next-intl/server";
import { EmergenciesPage } from "@/features/emergencies/components/emergencies-page";
import type { Locale } from "@/i18n/routing";

export default async function Page({ params }: PageProps<"/[locale]/admin/emergencies">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <EmergenciesPage />;
}
