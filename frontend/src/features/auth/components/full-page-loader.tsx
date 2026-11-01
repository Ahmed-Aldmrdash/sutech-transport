import { LogoMark } from "@/components/brand/logo";
import { Spinner } from "@/components/ui/spinner";

/** Shown while the saved session is read, or while redirecting. Never shows protected content. */
export function FullPageLoader({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-surface"
    >
      <LogoMark className="size-14 animate-pulse" />
      <span className="flex items-center gap-2 text-body-sm text-ink-muted">
        <Spinner />
        {label}
      </span>
    </div>
  );
}
