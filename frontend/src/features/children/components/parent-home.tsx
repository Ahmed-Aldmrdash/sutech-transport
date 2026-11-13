"use client";

import { UsersRound } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SessionStatus } from "@/features/auth/session/session-store";
import { useSession } from "@/features/auth/session/use-session";
import { firstNameOf, userText } from "@/features/auth/user-text";
import type { Locale } from "@/i18n/routing";
import { useChildren } from "./children-provider";
import { LiveBuses, ChildCard } from "./parent-home-cards";

/** The guardian's home: every child's day at a glance, then each bus they ride, live. */
export function ParentHome() {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const session = useSession();
  const { children } = useChildren();
  const firstName =
    session.status === SessionStatus.SignedIn
      ? firstNameOf(userText(session.session.user, locale).name)
      : "";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("session.welcome", { name: firstName })}
        description={t("parent.home.lead")}
      />
      {children.length === 0 ? (
        <EmptyState
          icon={<UsersRound />}
          title={t("parent.noChildrenTitle")}
          description={t("parent.noChildrenBody")}
        />
      ) : null}
      {children.length > 0 ? (
        <>
          <div className="grid grid-cols-1 items-start gap-5 desktop:grid-cols-2">
            {children.map((child) => (
              <ChildCard key={child.student_id} child={child} />
            ))}
          </div>
          <LiveBuses family={children} />
        </>
      ) : null}
    </div>
  );
}
