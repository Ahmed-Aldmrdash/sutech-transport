"use client";

import type { ReactNode } from "react";
import { Bell, LogOut, Settings } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMe, useSession } from "@/components/providers/SessionProvider";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { isMockMode } from "@/lib/config";
import { Brand } from "./Brand";
import { type NavItem, isActive } from "./nav";
import { NotificationBell } from "./NotificationBell";
import { LanguageToggle, ThemeToggle } from "./PreferenceToggles";

/**
 * Layout for students, parents and the bus crew.
 * Phone: app bar on top and a tab bar at the bottom. Laptop (lg and up): a sidebar with the same items,
 * notifications, settings and the signed-in user, and a wider content area.
 */
export function MobileShell({
  nav,
  notificationsHref,
  settingsHref,
  floating,
  children,
}: {
  nav: NavItem[];
  notificationsHref: string;
  settingsHref: string;
  /** Something that floats above the tab bar, e.g. the crew SOS button. */
  floating?: ReactNode;
  children: ReactNode;
}) {
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const tr = useTranslations("roles");
  const me = useMe();
  const { signOut } = useSession();
  const pathname = usePathname();

  return (
    <div className="min-h-dvh bg-surface pb-[calc(72px+env(safe-area-inset-bottom))] lg:grid lg:grid-cols-[264px_1fr] lg:pb-0">
      <aside className="sticky top-0 hidden h-dvh flex-col border-e border-line bg-surface-raised lg:flex">
        <div className="flex h-16 items-center px-5">
          <Link href={nav[0]?.href ?? "/"} aria-label={tc("goHome")}>
            <Brand />
          </Link>
        </div>
        <nav aria-label={t("main")} className="flex-1 overflow-y-auto px-3 pt-2">
          <ul className="flex flex-col gap-1">
            {nav.map((item) => (
              <li key={item.href}>
                <SideLink href={item.href} icon={item.icon} label={t(item.label)} active={isActive(pathname, item)} />
              </li>
            ))}
          </ul>
          <div className="my-3 border-t border-line" />
          <ul className="flex flex-col gap-1">
            <li>
              <SideLink href={notificationsHref} icon={Bell} label={tc("notifications")} active={pathname.startsWith(notificationsHref)} />
            </li>
            <li>
              <SideLink href={settingsHref} icon={Settings} label={tc("settings")} active={pathname.startsWith(settingsHref)} />
            </li>
          </ul>
        </nav>
        <div className="border-t border-line p-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-[15px] font-extrabold text-brand">
              {me.name.trim().charAt(0)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[14px] font-bold text-ink-strong">{me.name}</p>
              <p className="truncate text-[13px] text-ink-muted">{tr(me.role)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-md px-2 text-[14px] font-bold text-danger hover:bg-danger-soft"
          >
            <LogOut className="flip-rtl size-4" aria-hidden />
            {tc("signOut")}
          </button>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-line bg-surface-raised/95 pt-[env(safe-area-inset-top)] backdrop-blur">
          <div className="mx-auto flex h-14 max-w-xl items-center justify-between px-4 lg:h-16 lg:max-w-none lg:px-8">
            <Link href={nav[0]?.href ?? "/"} aria-label={tc("goHome")} className="lg:hidden">
              <Brand />
            </Link>
            <div className="ms-auto flex items-center gap-1 text-ink">
              {isMockMode && (
                <span className="me-1 hidden rounded-full bg-coral-soft px-2.5 py-0.5 text-[12px] font-bold text-coral-text sm:inline">
                  {tc("demoBadge")}
                </span>
              )}
              <NotificationBell href={notificationsHref} />
              <span className="hidden items-center gap-1 lg:flex">
                <LanguageToggle />
                <ThemeToggle />
              </span>
              <Link
                href={settingsHref}
                aria-label={tc("settings")}
                className="inline-flex size-10 items-center justify-center rounded-md hover:bg-brand-soft lg:hidden"
              >
                <Settings className="size-5" aria-hidden />
              </Link>
            </div>
          </div>
        </header>
        <main className={cn("mx-auto max-w-xl px-4 pt-4 lg:max-w-5xl lg:px-8 lg:pt-8", floating ? "pb-24" : "pb-6 lg:pb-12")}>
          {children}
        </main>
      </div>

      {floating}

      <nav
        aria-label={t("main")}
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface-raised pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <ul className="mx-auto flex max-w-xl">
          {nav.map((item) => {
            const active = isActive(pathname, item);
            const Icon = item.icon;
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-16 flex-col items-center justify-center gap-0.5 text-[12px] font-bold",
                    active ? "text-brand" : "text-ink-muted hover:text-ink",
                  )}
                >
                  <span className={cn("grid h-7 w-12 place-items-center rounded-full", active && "bg-brand-soft")}>
                    <Icon className="size-5" aria-hidden />
                  </span>
                  {t(item.label)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

function SideLink({
  href,
  icon: Icon,
  label,
  active,
}: {
  href: string;
  icon: NavItem["icon"];
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-md px-3 text-[15px] font-bold",
        active ? "bg-brand-soft text-brand" : "text-ink hover:bg-surface-alt",
      )}
    >
      <Icon className="size-5 shrink-0" aria-hidden />
      {label}
    </Link>
  );
}
