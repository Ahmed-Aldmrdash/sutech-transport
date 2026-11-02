import { setRequestLocale } from "next-intl/server";
import { LinesPage } from "@/features/lines/components/lines-page";
import type { Locale } from "@/i18n/routing";

export default async function Page({ params }: PageProps<"/[locale]/student/lines">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <LinesPage />;
}
