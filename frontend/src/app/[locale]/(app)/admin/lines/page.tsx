import { setRequestLocale } from "next-intl/server";
import { LinesPage } from "@/features/ops-desk/components/lines-page";
import type { Locale } from "@/i18n/routing";
import { pageTitle } from "@/i18n/page-title";

export const generateMetadata = pageTitle("desk.ops.lines.title");

export default async function Page({ params }: PageProps<"/[locale]/admin/lines">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <LinesPage />;
}
