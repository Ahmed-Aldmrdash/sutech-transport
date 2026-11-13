"use client";

import { MessageCircleQuestion } from "lucide-react";
import { useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

/** The AI assistant is the AI team's part; until it ships, its menu item opens this. */
export function AssistantSoonPage() {
  const t = useTranslations("student.assistant");
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("lead")} />
      <EmptyState
        icon={<MessageCircleQuestion />}
        title={t("soonTitle")}
        description={t("soonBody")}
        action={<ButtonLink href="/student/lines">{t("lines")}</ButtonLink>}
      />
    </div>
  );
}
