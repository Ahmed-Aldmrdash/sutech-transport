import { setRequestLocale } from "next-intl/server";
import { NotGoingPage } from "@/features/absences/components/not-going-page";
import type { Locale } from "@/i18n/routing";

export default async function Page({ params }: PageProps<"/[locale]/student/not-going-today">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <NotGoingPage />;
}
