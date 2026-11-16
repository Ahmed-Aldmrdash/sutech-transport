"use client";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { CountBadge } from "@/features/notifications/components/count-badge";
import {
  badgeSuffixKey,
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

/**
 * A long menu split into many groups (the offices') folds them: only the open ones show their
 * pages. A short one, or one with a group or two (students, guardians), stays open.
 */
const FOLD_AFTER_ITEMS = 10;
const FOLD_AFTER_GROUPS = 2;

/** The grouped menu, shared by the laptop sidebar and the phone drawer. */
export function NavLinks({ navigation, activeItem, onNavigate, badges }: NavLinksProps) {
  const t = useTranslations("nav");
  const showGroupTitles = navigation.groups.length > 1;
  const itemCount = navigation.groups.reduce((sum, group) => sum + group.items.length, 0);
  const folds = navigation.groups.length > FOLD_AFTER_GROUPS && itemCount > FOLD_AFTER_ITEMS;
  const activeGroup = navigation.groups.find((group) =>
    group.items.some((item) => item === activeItem),
  )?.key;
  // The group of the page on screen is always open; the office opens others as it likes.
  const [opened, setOpened] = useState<ReadonlySet<string>>(
    () => new Set([activeGroup ?? navigation.groups[0]?.key ?? ""]),
  );
  const toggle = (key: string) =>
    setOpened((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className={cn("flex flex-col", folds ? "gap-1" : "gap-5")}>
      {navigation.groups.map((group) => {
        const isOpen = !folds || group.key === activeGroup || opened.has(group.key);
        const listId = `nav-group-${group.key}`;
        const groupCount = group.items.reduce((sum, item) => sum + (badges?.[item.key] ?? 0), 0);
        return (
          <div key={group.key}>
            {folds ? (
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={listId}
                disabled={group.key === activeGroup}
                onClick={() => toggle(group.key)}
                className="flex min-h-9 w-full items-center gap-2 rounded-md px-3 text-label text-ink-muted focus-ring hover:bg-surface-alt hover:text-ink-strong disabled:hover:bg-transparent"
              >
                <span className="min-w-0 flex-1 text-start">{t(`groups.${group.key}`)}</span>
                {!isOpen && groupCount > 0 ? <CountBadge count={groupCount} /> : null}
                <ChevronDown
                  aria-hidden="true"
                  className={cn("size-4 shrink-0 transition-transform", isOpen && "rotate-180")}
                />
              </button>
            ) : showGroupTitles ? (
              <p className="mb-1.5 px-3 text-label text-ink-muted">{t(`groups.${group.key}`)}</p>
            ) : null}
            <ul id={listId} hidden={!isOpen} className="flex flex-col gap-0.5">
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
                      className={cn(
                        "flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-body-sm font-bold focus-ring transition-colors",
                        isActive
                          ? "bg-brand-soft text-brand"
                          : "text-ink hover:bg-surface-alt hover:text-ink-strong",
                      )}
                    >
                      <Icon aria-hidden="true" className="size-5 shrink-0" />
                      {/* Long labels ("Buses & drivers") wrap to a second line instead of being cut. */}
                      <span className="min-w-0 leading-tight">
                        {label}
                        {count ? (
                          <span className="sr-only">{t(badgeSuffixKey(item.key), { count })}</span>
                        ) : null}
                      </span>
                      {count ? <CountBadge count={count} className="ms-auto" /> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
