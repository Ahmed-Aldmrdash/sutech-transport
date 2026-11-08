import { setRequestLocale } from "next-intl/server";
import { LineChangePage } from "@/features/requests/components/line-change-page";
import type { Locale } from "@/i18n/routing";
import { pageTitle } from "@/i18n/page-title";

export const generateMetadata = pageTitle("student.requests.lineChange.title");

export default async function Page({
  params,
}: PageProps<"/[locale]/student/requests/new/line-change">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <LineChangePage />;
}
