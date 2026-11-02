import { setRequestLocale } from "next-intl/server";
import { LineDetailPage } from "@/features/lines/components/line-detail-page";
import type { Locale } from "@/i18n/routing";

export default async function Page({ params }: PageProps<"/[locale]/student/lines/[lineId]">) {
  const { locale, lineId } = await params;
  setRequestLocale(locale as Locale);
  return <LineDetailPage lineId={decodeURIComponent(lineId)} />;
}
