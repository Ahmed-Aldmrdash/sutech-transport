"use client";

import type { ReactNode } from "react";
import { AreaGuard } from "@/components/layout/AreaGuard";
import { PARENT_NAV } from "@/components/layout/areas";
import { MobileShell } from "@/components/layout/MobileShell";
import { ChildProvider } from "@/features/parent/components/ChildProvider";

export default function ParentLayout({ children }: { children: ReactNode }) {
  return (
    <AreaGuard area="parent">
      <ChildProvider>
        <MobileShell nav={PARENT_NAV} notificationsHref="/parent/notifications" settingsHref="/parent/settings">
          {children}
        </MobileShell>
      </ChildProvider>
    </AreaGuard>
  );
}
