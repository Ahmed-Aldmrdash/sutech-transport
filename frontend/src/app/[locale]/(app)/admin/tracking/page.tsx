import { setRequestLocale } from "next-intl/server";
import { LivePage } from "@/features/ops-desk/components/live-page";
import type { Locale } from "@/i18n/routing";
import { pageTitle } from "@/i18n/page-title";

export const generateMetadata = pageTitle("desk.ops.live.title");

export default async function Page({ params }: PageProps<"/[locale]/admin/tracking">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <LivePage />;
}
