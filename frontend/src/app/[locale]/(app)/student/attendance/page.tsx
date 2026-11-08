import { setRequestLocale } from "next-intl/server";
import { MyTripsPage } from "@/features/attendance/components/my-trips-page";
import type { Locale } from "@/i18n/routing";
import { pageTitle } from "@/i18n/page-title";

export const generateMetadata = pageTitle("nav.items.attendanceHistory");

export default async function Page({ params }: PageProps<"/[locale]/student/attendance">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <MyTripsPage />;
}
