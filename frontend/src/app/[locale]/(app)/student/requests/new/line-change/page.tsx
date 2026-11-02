import { setRequestLocale } from "next-intl/server";
import { LineChangePage } from "@/features/requests/components/line-change-page";
import type { Locale } from "@/i18n/routing";

export default async function Page({
  params,
}: PageProps<"/[locale]/student/requests/new/line-change">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <LineChangePage />;
}
