import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";

/** Screen title with an optional back link and actions. The arrow points "back" in both directions (flip-rtl). */
export function PageHeader({
  title,
  subtitle,
  back,
  backLabel,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  back?: string;
  backLabel?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-4 flex items-start gap-2">
      {back && (
        <Link
          href={back}
          aria-label={backLabel}
          className="-ms-2 mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-md text-ink hover:bg-brand-soft"
        >
          <ArrowRight className="size-5 ltr:rotate-180" aria-hidden />
        </Link>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="text-[24px] leading-8 font-extrabold text-ink-strong">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[15px] text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
