"use client";

import type { ReactNode } from "react";
import { AreaGuard } from "@/components/layout/AreaGuard";
import { STUDENT_NAV } from "@/components/layout/areas";
import { MobileShell } from "@/components/layout/MobileShell";

export default function StudentLayout({ children }: { children: ReactNode }) {
  return (
    <AreaGuard area="student">
      <MobileShell nav={STUDENT_NAV} notificationsHref="/student/notifications" settingsHref="/student/settings">
        {children}
      </MobileShell>
    </AreaGuard>
  );
}
