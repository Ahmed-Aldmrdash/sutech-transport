import { useTranslations } from "next-intl";
import { Logo } from "@/components/brand/logo";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The app's frame with grey placeholders, shown (and sent in the server's HTML) while the saved
 * session is read. The page keeps its shape from the first paint instead of a full-screen
 * loader; nothing protected is in it.
 */
export function ShellSkeleton() {
  const t = useTranslations();
  const logo = <Logo name={t("app.shortName")} tagline={t("app.tagline")} />;
  return (
    <div role="status" aria-live="polite" className="min-h-dvh bg-surface">
      <span className="sr-only">{t("session.checking")}</span>
      <aside
        aria-hidden="true"
        className="fixed inset-y-0 start-0 z-nav hidden w-sidebar flex-col gap-2 border-e border-line bg-surface-raised desktop:flex"
      >
        <div className="flex h-app-bar shrink-0 items-center border-b border-line px-5">{logo}</div>
        <div className="flex flex-col gap-2 p-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-11 w-full" />
          ))}
        </div>
      </aside>
      <div className="desktop:ps-sidebar" aria-hidden="true">
        <div className="sticky top-0 z-nav border-b border-line bg-glass">
          <div className="mx-auto flex h-app-bar max-w-content items-center gap-2 px-4 desktop:px-8">
            <span className="desktop:hidden">{logo}</span>
            <Skeleton className="ms-auto h-10 w-24" />
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-content flex-col gap-5 px-4 py-6 desktop:px-8 desktop:py-8">
          <Skeleton className="h-9 w-2/3 max-w-sm" />
          <Skeleton className="h-5 w-full max-w-md" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    </div>
  );
}
