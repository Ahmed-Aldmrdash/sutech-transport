import type { MetadataRoute } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { LOCALE_DIRECTION, routing } from "@/i18n/routing";
import { THEME_COLOR } from "@/lib/theme/theme";

export const dynamic = "force-static";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/** One manifest per language, so the installed app's name and direction match the reader's. */
export async function GET(_request: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale: asked } = await params;
  const locale = hasLocale(routing.locales, asked) ? asked : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: "app" });
  const manifest: MetadataRoute.Manifest = {
    id: "/",
    name: t("name"),
    short_name: t("shortName"),
    description: t("description"),
    lang: locale,
    dir: LOCALE_DIRECTION[locale],
    start_url: `/${locale}`,
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7f7f7",
    theme_color: THEME_COLOR.light,
    categories: ["education", "travel"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    screenshots: [
      {
        src: `/screenshots/${locale}-phone.png`,
        sizes: "780x1688",
        type: "image/png",
        form_factor: "narrow",
        label: t("name"),
      },
      {
        src: `/screenshots/${locale}-wide.png`,
        sizes: "1440x900",
        type: "image/png",
        form_factor: "wide",
        label: t("name"),
      },
    ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: { "Content-Type": "application/manifest+json" },
  });
}
