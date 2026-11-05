import { setRequestLocale } from "next-intl/server";
import { ChildDayPage } from "@/features/children/components/child-day-page";
import type { Locale } from "@/i18n/routing";

export default async function Page({ params }: PageProps<"/[locale]/parent/day">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <ChildDayPage />;
}
