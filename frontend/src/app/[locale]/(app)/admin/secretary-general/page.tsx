import { setRequestLocale } from "next-intl/server";
import { SgPage } from "@/features/sg-office/components/sg-page";
import type { Locale } from "@/i18n/routing";
import { pageTitle } from "@/i18n/page-title";

export const generateMetadata = pageTitle("nav.items.secretaryGeneral");

export default async function Page({ params }: PageProps<"/[locale]/admin/secretary-general">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <SgPage />;
}
