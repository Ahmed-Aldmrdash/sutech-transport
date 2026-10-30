import { Bus } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Wordmark in type only. The official SUTech mark must be copied from the brand manual's logo files
 * (05 - Design System/assets), never redrawn; drop it in here when the files are in the repo.
 */
export function Brand({ inverse = false, className }: { inverse?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className={cn("grid size-9 place-items-center rounded-md", inverse ? "bg-on-brand/15 text-on-brand" : "bg-brand text-on-brand")}>
        <Bus className="size-5" aria-hidden />
      </span>
      <span className={cn("text-[17px] leading-5 font-extrabold", inverse ? "text-on-brand" : "text-ink-strong")} dir="ltr">
        SUtech <span className={inverse ? "opacity-80" : "text-teal"}>Transport</span>
      </span>
    </span>
  );
}
