"use client";

import type { ReactNode } from "react";
import { Bus } from "lucide-react";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/ui/States";
import { Link } from "@/i18n/navigation";

/** Shown on subscriber-only pages (card, tracking) to a student without an active subscription, with the way in. */
export function SubscribersOnly({ title, body, icon }: { title: string; body: string; icon: ReactNode }) {
  const t = useTranslations("student.home");
  return (
    <EmptyState
      icon={icon}
      title={title}
      action={
        <Link
          href="/student/lines"
          className="label-caps inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-brand px-6 text-[15px] font-bold text-on-brand hover:bg-brand-deep"
        >
          <Bus className="size-4" aria-hidden />
          {t("bookNow")}
        </Link>
      }
    >
      {body}
    </EmptyState>
  );
}
