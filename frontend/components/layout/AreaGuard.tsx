"use client";

import { type ReactNode, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useSession } from "@/components/providers/SessionProvider";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { AREA_HOME, type AppArea, type Role, areaOf } from "@/features/auth/roles";
import { usePathname, useRouter } from "@/i18n/navigation";

/**
 * Keeps each role inside its own area. This only hides screens; the server refuses every call outside the role (403).
 */
export function AreaGuard({ area, children }: { area: AppArea; children: ReactNode }) {
  const { session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("common");
  const userArea = session.status === "authenticated" ? areaOf(session.user.role as Role) : null;

  useEffect(() => {
    if (session.status === "anonymous") router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    else if (userArea && userArea !== area) router.replace(AREA_HOME[userArea]);
  }, [session.status, userArea, area, router, pathname]);

  if (session.status !== "authenticated" || userArea !== area) {
    return (
      <div className="mx-auto max-w-md p-4">
        <PageSkeleton label={t("loading")} />
      </div>
    );
  }
  return <>{children}</>;
}
