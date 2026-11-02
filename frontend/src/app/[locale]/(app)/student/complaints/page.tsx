import { setRequestLocale } from "next-intl/server";
import { ComplaintsPage } from "@/features/requests/components/requests-page";
import type { Locale } from "@/i18n/routing";

export default async function Page({ params }: PageProps<"/[locale]/student/complaints">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <ComplaintsPage />;
}
