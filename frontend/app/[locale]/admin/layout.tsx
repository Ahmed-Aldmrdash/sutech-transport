"use client";

import type { ReactNode } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { AreaGuard } from "@/components/layout/AreaGuard";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AreaGuard area="admin">
      <AdminShell>{children}</AdminShell>
    </AreaGuard>
  );
}
