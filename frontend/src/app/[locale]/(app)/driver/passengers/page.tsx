import { setRequestLocale } from "next-intl/server";
import { PassengersPage } from "@/features/crew/components/passengers-page";
import type { Locale } from "@/i18n/routing";

export default async function Page({ params }: PageProps<"/[locale]/driver/passengers">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <PassengersPage />;
}
