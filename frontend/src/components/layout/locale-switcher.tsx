"use client";

import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { getPathname, usePathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";

const OTHER_LOCALE: Record<Locale, Locale> = { ar: "en", en: "ar" };

/**
 * Switches between Arabic and English on the same page.
 * It does a full page load (replacing the history entry) on purpose: each language has its own root layout (lang, dir,
 * fonts), and a full load lets the theme boot script run again so the page never flashes.
 */
export function LocaleSwitcher({
  className,
  onBrand = false,
}: {
  className?: string;
  onBrand?: boolean;
}) {
  const t = useTranslations("common");
  const locale = useLocale();
  const pathname = usePathname();
  const [isSwitching, setIsSwitching] = useState(false);
  const target = OTHER_LOCALE[locale];

  function switchLocale() {
    setIsSwitching(true);
    const { search, hash } = window.location;
    // A full load is intended here (see above), so the client-router rule doesn't apply.
    // replace, not assign: switching language must not add a step to the Back button.
    window.location.replace(`${getPathname({ href: pathname, locale: target })}${search}${hash}`);
  }

  return (
    <button
      type="button"
      onClick={switchLocale}
      disabled={isSwitching}
      lang={target}
      aria-label={t("switchLanguage")}
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-md px-3 text-body-sm font-bold focus-ring transition-colors disabled:opacity-60",
        onBrand ? "text-white hover:bg-white/15" : "text-ink-strong hover:bg-brand-soft",
        className,
      )}
    >
      <Languages aria-hidden="true" className="size-5" />
      <span>{t("otherLanguageName")}</span>
    </button>
  );
}
