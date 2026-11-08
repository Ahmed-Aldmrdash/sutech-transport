import { ChevronLeft } from "lucide-react";
import type { ComponentProps } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

/** "‹ Requests" above a page title: back to the list this page belongs to. */
export function BackLink({
  href,
  children,
  className,
}: {
  href: ComponentProps<typeof Link>["href"];
  children: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "tap-area inline-flex h-10 items-center gap-1 self-start rounded-md pe-2 text-body-sm font-bold text-brand focus-ring hover:underline",
        className,
      )}
    >
      <ChevronLeft aria-hidden="true" className="size-5 rtl:-scale-x-100" />
      {children}
    </Link>
  );
}
