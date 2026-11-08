import type { Metadata, Viewport } from "next";
import { Montserrat, Tajawal } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { AppProviders } from "@/components/providers/app-providers";
import { ThemeBootScript } from "@/components/providers/theme-boot-script";
import { LOCALE_DIRECTION, routing } from "@/i18n/routing";
import { THEME_COLOR } from "@/lib/theme/theme";
import "../globals.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-montserrat",
  display: "swap",
});

const tajawal = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-tajawal",
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale: asked } = await params;
  const locale = hasLocale(routing.locales, asked) ? asked : routing.defaultLocale;
  const t = await getTranslations({
    locale,
    namespace: "app",
  });
  return {
    title: { default: t("name"), template: `%s · ${t("shortName")}` },
    description: t("description"),
    applicationName: t("name"),
    manifest: `/${locale}/manifest.webmanifest`,
    appleWebApp: {
      capable: true,
      title: t("shortName"),
      statusBarStyle: "default",
      // iPhones show this while the installed app opens (one size, scaled by iOS).
      startupImage: [
        { url: "/splash/splash-light-1170x2532.png", media: "(prefers-color-scheme: light)" },
        { url: "/splash/splash-dark-1170x2532.png", media: "(prefers-color-scheme: dark)" },
      ],
    },
    formatDetection: { telephone: false },
    icons: {
      icon: [
        { url: "/icons/favicon.svg", type: "image/svg+xml" },
        { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      ],
      apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // The device's own theme until the person picks one (the theme provider then updates both).
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_COLOR.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLOR.dark },
  ],
};

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      dir={LOCALE_DIRECTION[locale]}
      className={`${montserrat.variable} ${tajawal.variable}`}
      suppressHydrationWarning
    >
      <head>
        <ThemeBootScript />
      </head>
      <body>
        <NextIntlClientProvider>
          <AppProviders>{children as ReactNode}</AppProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
