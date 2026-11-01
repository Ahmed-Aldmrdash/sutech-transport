import { render, type RenderOptions } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement, ReactNode } from "react";
import type { Locale } from "@/i18n/routing";
import ar from "@/messages/ar.json";
import en from "@/messages/en.json";

const MESSAGES = { ar, en } as const;

/** Renders a component with translations, like the app does. */
export function renderWithIntl(
  ui: ReactElement,
  { locale = "en", ...options }: RenderOptions & { locale?: Locale } = {},
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} timeZone="Africa/Cairo">
        {children}
      </NextIntlClientProvider>
    );
  }
  return render(ui, { wrapper: Wrapper, ...options });
}
