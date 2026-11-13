import { setRequestLocale } from "next-intl/server";
import { StudentsPage } from "@/features/ops-desk/components/students-page";
import type { Locale } from "@/i18n/routing";
import { pageTitle } from "@/i18n/page-title";

export const generateMetadata = pageTitle("desk.ops.students.title");

export default async function Page({ params }: PageProps<"/[locale]/admin/students">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <StudentsPage />;
}
