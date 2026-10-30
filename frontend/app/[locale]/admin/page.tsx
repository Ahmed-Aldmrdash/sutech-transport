"use client";

import { useEffect } from "react";
import { useMe } from "@/components/providers/SessionProvider";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { firstPageFor } from "@/features/auth/permissions";
import type { Role } from "@/features/auth/roles";
import { useRouter } from "@/i18n/navigation";

/** /admin opens the first page the role owns. */
export default function AdminHome() {
  const me = useMe();
  const router = useRouter();
  useEffect(() => {
    const page = firstPageFor(me.role as Role);
    router.replace(page ? `/admin/${page}` : "/login");
  }, [me.role, router]);
  return <PageSkeleton label="" />;
}
