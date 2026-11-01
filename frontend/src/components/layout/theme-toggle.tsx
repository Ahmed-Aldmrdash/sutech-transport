"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/cn";
import { ThemePreference } from "@/lib/theme/theme";
import { useTheme } from "@/lib/theme/theme-provider";

const ORDER: readonly ThemePreference[] = [
  ThemePreference.Light,
  ThemePreference.Dark,
  ThemePreference.System,
];
const ICON = { light: <Sun />, dark: <Moon />, system: <Monitor /> } as const;

/**
 * One button with two states: light ↔ dark. Until the user presses it the app follows the
 * device; "follow the device" can be chosen again from settings (ThemeSegmented).
 */
export function ThemeToggle({
  className,
  onBrand = false,
}: {
  className?: string;
  onBrand?: boolean;
}) {
  const t = useTranslations("theme");
  const { resolvedTheme, setPreference } = useTheme();
  const next =
    resolvedTheme === ThemePreference.Dark ? ThemePreference.Light : ThemePreference.Dark;

  return (
    <IconButton
      size="sm"
      variant={onBrand ? "onBrand" : "ghost"}
      className={cn(className)}
      icon={ICON[resolvedTheme]}
      label={t("toggle", { current: t(resolvedTheme), next: t(next) })}
      onClick={() => setPreference(next)}
    />
  );
}

/** The same choice as three visible options, for the settings page. */
export function ThemeSegmented({ className }: { className?: string }) {
  const t = useTranslations("theme");
  const { preference, setPreference } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label={t("label")}
      className={cn("inline-flex rounded-md border border-line bg-surface-alt p-1", className)}
    >
      {ORDER.map((option) => {
        const isSelected = option === preference;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => setPreference(option)}
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-sm px-3 text-body-sm font-bold focus-ring transition-colors [&_svg]:size-4",
              isSelected
                ? "bg-surface-raised text-brand shadow-sm"
                : "text-ink hover:text-ink-strong",
            )}
          >
            <span aria-hidden="true" className="inline-flex">
              {ICON[option]}
            </span>
            {t(option)}
          </button>
        );
      })}
    </div>
  );
}
