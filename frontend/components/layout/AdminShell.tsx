"use client";

import { type ReactNode, useEffect, useState } from "react";
import { LogOut, Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMe, useSession } from "@/components/providers/SessionProvider";
import { ADMIN_PAGE_ICONS } from "@/features/auth/admin-nav";
import { type AdminPage, pagesFor } from "@/features/auth/permissions";
import type { Role } from "@/features/auth/roles";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { isMockMode } from "@/lib/config";
import { Brand } from "./Brand";
import { NotificationBell } from "./NotificationBell";
import { LanguageToggle, ThemeToggle } from "./PreferenceToggles";

/** Dashboard layout: sidebar on wide screens, drawer under 1024px. The sidebar only lists the role's own pages. */
export function AdminShell({ children }: { children: ReactNode }) {
  const me = useMe();
  const { signOut } = useSession();
  const t = useTranslations("nav");
  const tr = useTranslations("roles");
  const tc = useTranslations("common");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const pages = pagesFor(me.role as Role);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const sidebar = (
    <nav aria-label={t("main")} className="flex h-full flex-col">
      <div className="flex h-16 items-center px-4">
        <Brand />
      </div>
      <ul className="flex-1 overflow-y-auto px-2 pb-4">
        {pages.map((page) => (
          <li key={page}>
            <SideLink page={page} active={pathname.startsWith(`/admin/${page}`)} label={t(`admin.${page}`)} />
          </li>
        ))}
      </ul>
      <div className="border-t border-line p-3">
        <p className="truncate text-[14px] font-bold text-ink-strong">{me.name}</p>
        <p className="truncate text-[13px] text-ink-muted">{tr(me.role)}</p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-2 inline-flex min-h-10 items-center gap-2 rounded-md px-2 text-[14px] font-bold text-danger hover:bg-danger-soft"
        >
          <LogOut className="flip-rtl size-4" aria-hidden />
          {tc("signOut")}
        </button>
      </div>
    </nav>
  );

  return (
    <div className="min-h-dvh bg-surface lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="sticky top-0 hidden h-dvh border-e border-line bg-surface-raised lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" aria-label={tc("close")} className="absolute inset-0 bg-overlay" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 start-0 w-[280px] max-w-[85vw] bg-surface-raised shadow-lg">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={tc("close")}
              className="absolute end-2 top-3 inline-flex size-10 items-center justify-center rounded-md hover:bg-surface-alt"
            >
              <X className="size-5" aria-hidden />
            </button>
            {sidebar}
          </aside>
        </div>
      )}
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-line bg-surface-raised/95 px-4 backdrop-blur">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={t("openMenu")}
            className="inline-flex size-10 items-center justify-center rounded-md hover:bg-brand-soft lg:hidden"
          >
            <Menu className="size-5" aria-hidden />
          </button>
          <div className="lg:hidden">
            <Brand />
          </div>
          <div className="ms-auto flex items-center gap-1 text-ink">
            {isMockMode && (
              <span className="me-1 hidden rounded-full bg-coral-soft px-2 py-0.5 text-[12px] font-bold text-coral-text md:inline">
                {tc("demoBadge")}
              </span>
            )}
            <NotificationBell href="/admin/notifications" />
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </header>
        <main className="mx-auto max-w-6xl p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}

function SideLink({ page, active, label }: { page: AdminPage; active: boolean; label: string }) {
  const Icon = ADMIN_PAGE_ICONS[page];
  return (
    <Link
      href={`/admin/${page}`}
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
