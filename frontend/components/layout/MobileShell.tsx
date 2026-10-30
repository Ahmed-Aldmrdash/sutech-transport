"use client";

import type { ReactNode } from "react";
import { Settings } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { isMockMode } from "@/lib/config";
import { Brand } from "./Brand";
import { type NavItem, isActive } from "./nav";
import { NotificationBell } from "./NotificationBell";

/** Phone layout for students, parents and the bus crew: app bar on top, tab bar at the bottom. */
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
  const pathname = usePathname();
  return (
    <div className="min-h-dvh bg-surface pb-[calc(72px+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-30 border-b border-line bg-surface-raised/95 backdrop-blur pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-xl items-center justify-between px-4">
          <Link href={nav[0]?.href ?? "/"} aria-label={tc("goHome")}>
            <Brand />
          </Link>
          <div className="flex items-center gap-1 text-ink">
            {isMockMode && (
              <span className="me-1 hidden rounded-full bg-coral-soft px-2 py-0.5 text-[12px] font-bold text-coral-text sm:inline">
                {tc("demoBadge")}
              </span>
            )}
            <NotificationBell href={notificationsHref} />
            <Link
              href={settingsHref}
              aria-label={tc("settings")}
              className="inline-flex size-10 items-center justify-center rounded-md hover:bg-brand-soft"
            >
              <Settings className="size-5" aria-hidden />
            </Link>
          </div>
        </div>
      </header>
      <main className={cn("mx-auto max-w-xl px-4 pt-4", floating ? "pb-24" : "pb-6")}>{children}</main>
      {floating}
      <nav
        aria-label={t("main")}
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface-raised pb-[env(safe-area-inset-bottom)]"
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
