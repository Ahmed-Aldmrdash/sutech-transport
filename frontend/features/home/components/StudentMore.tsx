"use client";

import { ArrowLeft, Bot, CreditCard, FileText, Megaphone, MessageSquareWarning, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { Link } from "@/i18n/navigation";

const ITEMS: { href: string; key: string; icon: LucideIcon }[] = [
  { href: "/student/announcements", key: "announcements", icon: Megaphone },
  { href: "/student/requests", key: "requests", icon: FileText },
  { href: "/student/complaints", key: "complaints", icon: MessageSquareWarning },
  { href: "/student/chat", key: "chat", icon: Bot },
  { href: "/student/payment", key: "payment", icon: CreditCard },
  { href: "/student/settings", key: "settings", icon: Settings },
];

export function StudentMore() {
  const t = useTranslations("student.more");
  return (
    <>
      <PageHeader title={t("title")} />
      <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-card border border-line bg-surface-raised lg:grid lg:grid-cols-2 lg:gap-4 lg:divide-y-0 lg:overflow-visible lg:border-0 lg:bg-transparent">
        {ITEMS.map(({ href, key, icon: Icon }) => (
          <li key={href}>
            <Link href={href} className="flex min-h-16 items-center gap-3 px-4 hover:bg-surface-alt lg:min-h-24 lg:rounded-card lg:border lg:border-line lg:bg-surface-raised lg:px-5 lg:hover:border-brand">
              <span className="grid size-10 shrink-0 place-items-center rounded-md bg-brand-soft text-brand lg:size-12">
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold text-ink-strong">{t(`${key}.title`)}</span>
                <span className="block text-[14px] text-ink-muted">{t(`${key}.body`)}</span>
              </span>
              <ArrowLeft className="flip-rtl size-5 text-ink-muted" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
