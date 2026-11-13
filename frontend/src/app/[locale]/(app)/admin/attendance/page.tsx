import { setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { AttendancePage } from "@/features/ops-desk/components/attendance-page";
import type { Locale } from "@/i18n/routing";
import { pageTitle } from "@/i18n/page-title";

export const generateMetadata = pageTitle("desk.ops.attendance.title");

export default async function Page({ params }: PageProps<"/[locale]/admin/attendance">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return (
    <Suspense>
      <AttendancePage />
    </Suspense>
  );
}
