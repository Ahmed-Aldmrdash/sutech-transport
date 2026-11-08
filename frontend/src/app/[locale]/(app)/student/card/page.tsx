import { setRequestLocale } from "next-intl/server";
import { CardPage } from "@/features/card/components/card-page";
import type { Locale } from "@/i18n/routing";
import { pageTitle } from "@/i18n/page-title";

export const generateMetadata = pageTitle("nav.items.card");

export default async function Page({ params }: PageProps<"/[locale]/student/card">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <CardPage />;
}
