"use client";

import { Bus, Clock, Hammer, UsersRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { SampleLinesTable } from "@/features/ui-gallery/sample-lines";
import type { Role } from "@/lib/auth/roles";
import { findActiveItem, navigationFor, roleHomeHref } from "../nav-config";

interface RolePreviewProps {
  role: Role;
  /** The sub-path inside the preview, e.g. "payments". Empty for the role's home. */
  section: string;
}

const SAMPLE_KPIS = {
  students: 612,
  seats: 720,
  buses: 14,
  totalBuses: 16,
  onTime: "92%",
} as const;

/** Shows a role's real frame and menu with placeholder content, before its pages exist. */
export function RolePreview({ role, section }: RolePreviewProps) {
  const t = useTranslations();
  const basePath = `/preview/${role}` as const;
  const navigation = { ...navigationFor(role), basePath };
  const pathname = section ? `${basePath}/${section}` : roleHomeHref(navigation);
  const activeItem = findActiveItem(navigation, basePath, pathname);
  const isHome = pathname === roleHomeHref(navigation);

  return (
    <AppShell
      navigation={navigation}
      user={{ name: t("preview.sampleUser"), roleLabel: t(`roles.${role}`) }}
      onSignOut={() => undefined}
    >
      <div className="flex flex-col gap-6">
        <PageHeader
          eyebrow={t(`roles.${role}`)}
          title={activeItem ? t(`nav.items.${activeItem.key}`) : t("preview.title")}
          description={isHome ? t("preview.dashboardBody") : undefined}
        />
        {isHome ? (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <StatTile
                label={t("preview.kpiStudents")}
                value={SAMPLE_KPIS.students}
                caption={t("preview.kpiOfSeats", { total: SAMPLE_KPIS.seats })}
                icon={<UsersRound />}
              />
              <StatTile
                label={t("preview.kpiBuses")}
                value={SAMPLE_KPIS.buses}
                caption={t("preview.kpiOfBuses", { total: SAMPLE_KPIS.totalBuses })}
                icon={<Bus />}
              />
              <StatTile
                className="col-span-2 sm:col-span-1"
                label={t("preview.kpiOnTime")}
                value={SAMPLE_KPIS.onTime}
                icon={<Clock />}
              />
            </div>
            <Card>
              <CardHeader title={t("preview.dashboardTitle")} />
              <CardBody>
                <SampleLinesTable />
              </CardBody>
            </Card>
          </>
        ) : (
          <EmptyState
            icon={<Hammer />}
            title={t("preview.pageComing")}
            description={t("preview.pageComingBody")}
          />
        )}
      </div>
    </AppShell>
  );
}
