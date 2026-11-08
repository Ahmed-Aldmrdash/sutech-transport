"use client";

import { Construction } from "lucide-react";
import { useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Tone } from "@/components/ui/tone";
import { homePathFor } from "@/features/auth/access";
import { SessionStatus } from "@/features/auth/session/session-store";
import { useSession } from "@/features/auth/session/use-session";
import { usePathname } from "@/i18n/navigation";
import { isMockMode } from "@/lib/config";
import { findSoonItem, navigationFor } from "../nav-config";

/** A planned office page: what it will be, and that the office still does this work by hand. */
export function PlannedOfficePage() {
  const t = useTranslations();
  const pathname = usePathname();
  const state = useSession();
  if (state.status !== SessionStatus.SignedIn) return null;
  const { role } = state.session.user;
  const navigation = navigationFor(role);
  const item = findSoonItem(navigation, pathname);
  const page = item ? t(`nav.items.${item.key}`) : "";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow={t(`roles.${role}`)} title={page} />
      <EmptyState
        icon={<Construction />}
        title={t("session.plannedTitle")}
        description={t("session.plannedBody", { page })}
        action={<ButtonLink href={homePathFor(role)}>{t("session.plannedHome")}</ButtonLink>}
      />
      {isMockMode ? <Alert tone={Tone.Info} title={t("session.plannedDemoNote")} /> : null}
    </div>
  );
}
