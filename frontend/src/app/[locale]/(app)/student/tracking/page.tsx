import { setRequestLocale } from "next-intl/server";
import { StudentTrackingPage } from "@/features/tracking/components/student-tracking-page";
import type { Locale } from "@/i18n/routing";

export default async function Page({ params }: PageProps<"/[locale]/student/tracking">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <StudentTrackingPage />;
}
