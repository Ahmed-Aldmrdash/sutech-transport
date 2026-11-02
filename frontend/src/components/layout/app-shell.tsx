"use client";

import { LogOut, Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { IconButton } from "@/components/ui/icon-button";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import {
  findActiveItem,
  primaryItems,
  roleHomeHref,
  type NavBadges,
  type RoleNavigation,
} from "@/features/navigation/nav-config";
import { BottomNav } from "./bottom-nav";
import { LocaleSwitcher } from "./locale-switcher";
import { MobileDrawer } from "./mobile-drawer";
import { NavLinks } from "./nav-links";
import { ThemeToggle } from "./theme-toggle";
import { UserBadge, type ShellUser } from "./user-badge";

interface AppShellProps {
  navigation: RoleNavigation;
  user: ShellUser;
  /** Wired in phase 1 (login). Hidden when not given. */
  onSignOut?: () => void;
  /** Extra controls in the top bar, before language and theme (e.g. notifications). */
  topBarActions?: ReactNode;
  /** Counts shown on menu items, e.g. unread notifications. */
  badges?: NavBadges;
  children: ReactNode;
}

/**
 * The frame around every signed-in page, for every role.
 * Laptop (≥1024px): fixed sidebar at the start edge + top bar + content capped at 1280px.
 * Phone: top app bar with a menu button, and a bottom bar for the role's main pages.
 */
export function AppShell({
  navigation,
  user,
  onSignOut,
  topBarActions,
  badges,
  children,
}: AppShellProps) {
  const t = useTranslations();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const homeHref = roleHomeHref(navigation);
  const activeItem = findActiveItem(navigation, navigation.basePath, pathname);
  const bottomItems = primaryItems(navigation);
  const totalItems = navigation.groups.reduce((count, group) => count + group.items.length, 0);
  const hasOverflow = totalItems > bottomItems.length;
  const logo = <Logo name={t("app.shortName")} tagline={t("app.tagline")} />;

  const signOut = onSignOut ? (
    <button
      type="button"
      onClick={onSignOut}
      className="flex h-11 w-full items-center gap-3 rounded-md px-3 text-body-sm font-bold text-ink focus-ring hover:bg-danger-soft hover:text-danger"
    >
      <LogOut aria-hidden="true" className="size-5 rtl:-scale-x-100" />
      {t("common.signOut")}
    </button>
  ) : null;

  return (
    <div className="min-h-dvh bg-surface">
      <a
        href="#main"
        className="sr-only z-toast rounded-md bg-brand px-4 py-2 text-on-brand focus-ring focus:not-sr-only focus:fixed focus:start-4 focus:top-4"
      >
        {t("common.skipToContent")}
      </a>

      <aside className="fixed inset-y-0 start-0 z-nav hidden w-sidebar flex-col border-e border-line bg-surface-raised desktop:flex">
        <div className="flex h-app-bar shrink-0 items-center border-b border-line px-5">
          <Link href={homeHref} className="rounded-sm focus-ring">
            {logo}
          </Link>
        </div>
        <nav aria-label={t("common.mainNavigation")} className="flex-1 overflow-y-auto p-3">
          <NavLinks navigation={navigation} activeItem={activeItem} badges={badges} />
        </nav>
        <div className="flex flex-col gap-2 border-t border-line p-3">
          <UserBadge user={user} className="px-2 py-1" />
          {signOut}
        </div>
      </aside>

      <div className="desktop:ps-sidebar">
        <header className="sticky top-0 z-nav border-b border-line bg-glass backdrop-blur-md">
          <div className="mx-auto flex h-app-bar max-w-content items-center gap-2 px-2 desktop:px-8">
            <IconButton
              className="desktop:hidden"
              label={t("common.openMenu")}
              icon={<Menu />}
              onClick={() => setIsMenuOpen(true)}
            />
            <Link href={homeHref} className="min-w-0 rounded-sm focus-ring desktop:hidden">
              {logo}
            </Link>
            <p className="hidden min-w-0 truncate text-body-sm font-bold text-ink-muted desktop:block">
              {activeItem ? t(`nav.items.${activeItem.key}`) : null}
            </p>
            <div className="ms-auto flex items-center gap-1">
              {topBarActions}
              <LocaleSwitcher className="max-sm:px-2 max-sm:[&>span]:sr-only" />
              <ThemeToggle />
              <span className="hidden desktop:inline-flex">
                <UserBadge user={user} compact />
              </span>
            </div>
          </div>
        </header>

        <main
          id="main"
          tabIndex={-1}
          className={cn(
            "mx-auto w-full max-w-content px-4 py-6 outline-none desktop:px-8 desktop:py-8",
            bottomItems.length > 0 &&
              "pb-[calc(var(--sut-nav-height)+env(safe-area-inset-bottom)+2rem)] desktop:pb-8",
          )}
        >
          {children}
        </main>
      </div>

      {bottomItems.length > 0 ? (
        <BottomNav
          basePath={navigation.basePath}
          items={bottomItems}
          activeItem={activeItem}
          badges={badges}
          onOpenMenu={hasOverflow ? () => setIsMenuOpen(true) : undefined}
        />
      ) : null}

      <MobileDrawer open={isMenuOpen} onClose={() => setIsMenuOpen(false)} header={logo}>
        <NavLinks
          navigation={navigation}
          activeItem={activeItem}
          badges={badges}
          onNavigate={() => setIsMenuOpen(false)}
        />
        {signOut ? (
          <div className="mt-5 border-t border-line pt-3">
            <UserBadge user={user} className="mb-2 px-2 py-1" />
            {signOut}
          </div>
        ) : (
          <div className="mt-5 border-t border-line pt-3">
            <UserBadge user={user} className="px-2 py-1" />
          </div>
        )}
      </MobileDrawer>
    </div>
  );
}
