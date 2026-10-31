"use client";

import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMe } from "@/components/providers/SessionProvider";
import { Banner } from "@/components/ui/Banner";
import { EmptyState } from "@/components/ui/States";
import { type AdminPage, canSeePage, isReadOnly } from "@/features/auth/permissions";
import type { Role } from "@/features/auth/roles";

/** Hides an admin page from roles that don't own it (the server also answers 403). */
export function RequirePage({ page, children }: { page: AdminPage; children: ReactNode }) {
  const me = useMe();
  const t = useTranslations("common");
  const role = me.role as Role;
  if (!canSeePage(role, page)) {
    return <EmptyState icon={<Lock className="size-8" aria-hidden />} title={t("forbiddenTitle")}>{t("forbiddenBody")}</EmptyState>;
  }
  return (
    <>
      {isReadOnly(role) && <Banner className="mb-4">{t("readOnly")}</Banner>}
      {children}
    </>
  );
}

/** True when the signed-in admin may change things (not the read-only secretary general). */
export function useCanEdit(): boolean {
  return !isReadOnly(useMe().role as Role);
}
