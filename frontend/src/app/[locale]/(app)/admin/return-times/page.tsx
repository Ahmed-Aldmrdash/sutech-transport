import { setRequestLocale } from "next-intl/server";
import { ReturnTimesPage } from "@/features/timetable/components/return-times-page";
import type { Locale } from "@/i18n/routing";
import { pageTitle } from "@/i18n/page-title";

export const generateMetadata = pageTitle("desk.ops.returnTimes.title");

export default async function Page({ params }: PageProps<"/[locale]/admin/return-times">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <ReturnTimesPage />;
}
