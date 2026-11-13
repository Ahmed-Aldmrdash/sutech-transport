import { setRequestLocale } from "next-intl/server";
import { LineDetailPage } from "@/features/ops-desk/components/line-detail-page";
import type { Locale } from "@/i18n/routing";
import { pageTitle } from "@/i18n/page-title";

export const generateMetadata = pageTitle("desk.ops.lines.title");

export default async function Page({ params }: PageProps<"/[locale]/admin/lines/[lineId]">) {
  const { locale, lineId } = await params;
  setRequestLocale(locale as Locale);
  return <LineDetailPage lineId={lineId} />;
}
