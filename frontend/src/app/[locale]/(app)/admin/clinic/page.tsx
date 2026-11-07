import { setRequestLocale } from "next-intl/server";
import { ClinicPage } from "@/features/emergencies/components/clinic-page";
import type { Locale } from "@/i18n/routing";

export default async function Page({ params }: PageProps<"/[locale]/admin/clinic">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <ClinicPage />;
}
