import { setRequestLocale } from "next-intl/server";
import { StudentHome } from "@/features/student-home/components/student-home";
import type { Locale } from "@/i18n/routing";

export default async function Page({ params }: PageProps<"/[locale]/student">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <StudentHome />;
}
