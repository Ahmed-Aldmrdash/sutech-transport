"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { CountBadge } from "@/features/notifications/components/count-badge";
import {
  itemHref,
  type NavBadges,
  type NavItem,
  type RoleNavigation,
} from "@/features/navigation/nav-config";

interface NavLinksProps {
  navigation: RoleNavigation;
  activeItem: NavItem | undefined;
  /** Called after a link is chosen (closes the phone menu). */
  onNavigate?: () => void;
  badges?: NavBadges;
}

/** The grouped menu, shared by the laptop sidebar and the phone drawer. */
export function NavLinks({ navigation, activeItem, onNavigate, badges }: NavLinksProps) {
  const t = useTranslations("nav");
  const tCount = useTranslations("notifications");
  const showGroupTitles = navigation.groups.length > 1;

  return (
    <div className="flex flex-col gap-5">
      {navigation.groups.map((group) => (
        <div key={group.key}>
          {showGroupTitles ? (
            <p className="mb-1.5 px-3 text-label text-ink-muted">{t(`groups.${group.key}`)}</p>
          ) : null}
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const isActive = item === activeItem;
              const Icon = item.icon;
              if (item.soon) {
                return (
                  <li key={item.key}>
                    <span
                      aria-disabled="true"
                      className="flex h-11 items-center gap-3 rounded-md px-3 text-body-sm font-bold text-ink-muted"
                    >
                      <Icon aria-hidden="true" className="size-5 shrink-0" />
                      <span className="truncate">{t(`items.${item.key}`)}</span>
                      <span className="ms-auto shrink-0 rounded-pill bg-surface-alt px-2 py-0.5 text-caption font-bold text-ink-muted">
                        {t("soon")}
                      </span>
                    </span>
                  </li>
                );
              }
              return (
                <li key={item.key}>
                  <Link
                    href={itemHref(navigation.basePath, item)}
                    onClick={onNavigate}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex h-11 items-center gap-3 rounded-md px-3 text-body-sm font-bold focus-ring transition-colors",
                      isActive
                        ? "bg-brand-soft text-brand"
                        : "text-ink hover:bg-surface-alt hover:text-ink-strong",
                    )}
                  >
                    <Icon aria-hidden="true" className="size-5 shrink-0" />
                    <span className="truncate">{t(`items.${item.key}`)}</span>
                    {badges?.[item.key] ? (
                      <>
                        <CountBadge count={badges[item.key] ?? 0} className="ms-auto" />
                        <span className="sr-only">
                          {tCount("newCount", { count: badges[item.key] ?? 0 })}
                        </span>
                      </>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
