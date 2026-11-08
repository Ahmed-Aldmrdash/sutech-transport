"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { CountBadge } from "@/features/notifications/components/count-badge";
import {
  badgeLabelKey,
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
                const content = (
                  <>
                    <Icon aria-hidden="true" className="size-5 shrink-0" />
                    <span className="min-w-0 leading-tight">{t(`items.${item.key}`)}</span>
                    <span className="ms-auto shrink-0 rounded-pill bg-surface-alt px-2 py-0.5 text-caption font-bold text-ink-muted">
                      {t("soon")}
                    </span>
                  </>
                );
                const soonStyles =
                  "flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-body-sm font-bold text-ink-muted";
                // A planned page opens a short "being built" page; an office home has none.
                return (
                  <li key={item.key}>
                    {item.segment ? (
                      <Link
                        href={itemHref(navigation.basePath, item)}
                        onClick={onNavigate}
                        className={cn(soonStyles, "focus-ring hover:bg-surface-alt")}
                      >
                        {content}
                      </Link>
                    ) : (
                      <span aria-disabled="true" className={soonStyles}>
                        {content}
                      </span>
                    )}
                  </li>
                );
              }
              const count = badges?.[item.key] ?? 0;
              const label = t(`items.${item.key}`);
              return (
                <li key={item.key}>
                  <Link
                    href={itemHref(navigation.basePath, item)}
                    onClick={onNavigate}
                    aria-current={isActive ? "page" : undefined}
                    aria-label={count ? t(badgeLabelKey(item.key), { label, count }) : undefined}
                    className={cn(
                      "flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-body-sm font-bold focus-ring transition-colors",
                      isActive
                        ? "bg-brand-soft text-brand"
                        : "text-ink hover:bg-surface-alt hover:text-ink-strong",
                    )}
                  >
                    <Icon aria-hidden="true" className="size-5 shrink-0" />
                    {/* Long labels ("Buses & drivers") wrap to a second line instead of being cut. */}
                    <span className="min-w-0 leading-tight">{label}</span>
                    {count ? <CountBadge count={count} className="ms-auto" /> : null}
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
