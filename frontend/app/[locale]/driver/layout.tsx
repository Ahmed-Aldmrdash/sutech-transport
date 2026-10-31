"use client";

import type { ReactNode } from "react";
import { AreaGuard } from "@/components/layout/AreaGuard";
import { CREW_NAV } from "@/components/layout/areas";
import { MobileShell } from "@/components/layout/MobileShell";
import { SosButton } from "@/features/sos/components/SosButton";

export default function CrewLayout({ children }: { children: ReactNode }) {
  return (
    <AreaGuard area="crew">
      <MobileShell nav={CREW_NAV} notificationsHref="/driver/notifications" settingsHref="/driver/settings" floating={<SosButton />}>
        {children}
      </MobileShell>
    </AreaGuard>
  );
}
