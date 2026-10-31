"use client";

import { Languages, Moon, Sun } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "@/components/providers/ThemeProvider";
import { usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

export function LanguageToggle({ className }: { className?: string }) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("common");
  const next = locale === "ar" ? "en" : "ar";
  return (
    <button
      type="button"
      onClick={() => router.replace(`${pathname}${window.location.search}`, { locale: next })}
      className={cn("inline-flex min-h-10 items-center gap-1.5 rounded-md px-3 text-[14px] font-bold hover:bg-brand-soft", className)}
      aria-label={t("switchLanguage")}
    >
      <Languages className="size-4" aria-hidden />
      <span lang={next}>{next === "ar" ? "العربية" : "English"}</span>
    </button>
  );
}

export function ThemeToggle({ className }: { className?: string }) {
  const { resolved, setChoice } = useTheme();
  const t = useTranslations("common");
  const isDark = resolved === "dark";
  return (
    <button
      type="button"
      onClick={() => setChoice(isDark ? "light" : "dark")}
      className={cn("inline-flex size-10 items-center justify-center rounded-md hover:bg-brand-soft", className)}
      aria-label={isDark ? t("lightMode") : t("darkMode")}
    >
      {isDark ? <Sun className="size-5" aria-hidden /> : <Moon className="size-5" aria-hidden />}
    </button>
  );
}
