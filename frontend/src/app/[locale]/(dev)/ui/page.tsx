import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { GalleryPage } from "@/features/ui-gallery/components/gallery-page";
import type { Locale } from "@/i18n/routing";
import { areDevPagesOn } from "@/lib/config";

export async function generateMetadata({ params }: PageProps<"/[locale]/ui">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "gallery" });
  return { title: t("title"), robots: { index: false } };
}

/** Developer gallery of every base component. Hidden unless NEXT_PUBLIC_DEV_PAGES is on (never in live mode). */
export default async function UiGalleryRoute({ params }: PageProps<"/[locale]/ui">) {
  if (!areDevPagesOn) notFound();
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <GalleryPage />;
}
