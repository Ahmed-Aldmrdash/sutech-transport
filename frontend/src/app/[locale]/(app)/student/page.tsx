import { setRequestLocale } from "next-intl/server";
import { StudentHome } from "@/features/student-home/components/student-home";
import type { Locale } from "@/i18n/routing";
import { pageTitle } from "@/i18n/page-title";

export const generateMetadata = pageTitle("nav.items.home");

export default async function Page({ params }: PageProps<"/[locale]/student">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <StudentHome />;
}
