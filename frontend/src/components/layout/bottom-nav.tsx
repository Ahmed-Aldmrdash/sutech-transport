"use client";

import { Menu } from "lucide-react";
import { useMessages, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import {
  badgeSuffixKey,
  itemHref,
  type NavBadges,
  type NavItem,
} from "@/features/navigation/nav-config";
import { CountBadge } from "@/features/notifications/components/count-badge";

interface BottomNavProps {
  basePath: string;
  items: readonly NavItem[];
  activeItem: NavItem | undefined;
  /** Opens the full menu; shown when the role has more pages than fit in the bar. */
  onOpenMenu?: () => void;
  badges?: NavBadges;
}

const itemStyles =
  "focus-ring flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-md text-caption font-bold transition-colors";

/** Phone bottom bar (64px) for the role's main pages. Hidden on laptops, where the sidebar shows. */
export function BottomNav({ basePath, items, activeItem, onOpenMenu, badges }: BottomNavProps) {
  const t = useTranslations();
  // The bar is narrow: use the short label when one exists ("Alerts" for "Notifications").
  const shortLabels: Partial<Record<NavItem["key"], string>> = useMessages().nav.short;
  const shortLabel = (item: NavItem) => shortLabels[item.key] ?? t(`nav.items.${item.key}`);

  return (
    <nav
      aria-label={t("common.quickNavigation")}
      className="fixed inset-x-0 bottom-0 z-nav border-t border-line bg-surface-raised pb-[env(safe-area-inset-bottom)] desktop:hidden"
    >
      <ul className="mx-auto flex h-bottom-nav max-w-xl items-stretch gap-1 px-2 py-1.5">
        {items.map((item) => {
          const isActive = item === activeItem;
          const Icon = item.icon;
          const count = badges?.[item.key] ?? 0;
          return (
            <li key={item.key} className="flex min-w-0 flex-1">
              <Link
                href={itemHref(basePath, item)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  itemStyles,
                  isActive ? "text-brand" : "text-ink-muted hover:text-ink-strong",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "relative inline-flex h-7 w-12 items-center justify-center rounded-pill transition-colors",
                    isActive && "bg-brand-soft",
                  )}
                >
                  <Icon className="size-5" />
                  {count ? <CountBadge count={count} className="absolute end-1 -top-1" /> : null}
                </span>
                <span className="max-w-full truncate px-0.5">{shortLabel(item)}</span>
                {count ? (
                  <span className="sr-only">{t(`nav.${badgeSuffixKey(item.key)}`, { count })}</span>
                ) : null}
              </Link>
            </li>
          );
        })}
        {onOpenMenu ? (
          <li className="flex min-w-0 flex-1">
            <button
              type="button"
              onClick={onOpenMenu}
              className={cn(itemStyles, "text-ink-muted hover:text-ink-strong")}
            >
              <span aria-hidden="true" className="inline-flex h-7 w-12 items-center justify-center">
                <Menu className="size-5" />
              </span>
              <span className="max-w-full truncate px-0.5">{t("common.more")}</span>
            </button>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}
