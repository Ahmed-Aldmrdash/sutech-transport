import { setRequestLocale } from "next-intl/server";
import { StudentDetailPage } from "@/features/ops-desk/components/student-detail-page";
import type { Locale } from "@/i18n/routing";
import { pageTitle } from "@/i18n/page-title";

export const generateMetadata = pageTitle("desk.ops.students.title");

export default async function Page({ params }: PageProps<"/[locale]/admin/students/[studentId]">) {
  const { locale, studentId } = await params;
  setRequestLocale(locale as Locale);
  return <StudentDetailPage studentId={studentId} />;
}
