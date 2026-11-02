import { setRequestLocale } from "next-intl/server";
import { CardPage } from "@/features/card/components/card-page";
import type { Locale } from "@/i18n/routing";

export default async function Page({ params }: PageProps<"/[locale]/student/card">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <CardPage />;
}
