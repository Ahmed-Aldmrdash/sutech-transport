import { setRequestLocale } from "next-intl/server";
import { AdminHome } from "@/features/ops-desk/components/admin-home";
import type { Locale } from "@/i18n/routing";
import { pageTitle } from "@/i18n/page-title";

export const generateMetadata = pageTitle("nav.items.overview");

/** The Transportation office's overview; any other office is sent to its own home. */
export default async function Page({ params }: PageProps<"/[locale]/admin">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <AdminHome />;
}
