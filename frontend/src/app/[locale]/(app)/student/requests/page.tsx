import { setRequestLocale } from "next-intl/server";
import { RequestsPage } from "@/features/requests/components/requests-page";
import type { Locale } from "@/i18n/routing";

export default async function Page({ params }: PageProps<"/[locale]/student/requests">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <RequestsPage />;
}
