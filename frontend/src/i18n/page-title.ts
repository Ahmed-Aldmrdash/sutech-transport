import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

/**
 * `generateMetadata` for a page whose tab title is one message, e.g. `pageTitle("nav.items.card")`.
 * The locale layout adds " · SUtech Transport", so every tab and history entry says which page
 * it is (WCAG 2.4.2).
 */
export function pageTitle(messageKey: string) {
  return async function generateMetadata({
    params,
  }: {
    params: Promise<{ locale: string }>;
  }): Promise<Metadata> {
    const { locale } = await params;
    const t = await getTranslations({
      locale: hasLocale(routing.locales, locale) ? locale : routing.defaultLocale,
    });
    return { title: t(messageKey as Parameters<typeof t>[0]) };
  };
}
