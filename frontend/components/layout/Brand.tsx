import Image from "next/image";
import { cn } from "@/lib/cn";

/**
 * The official SUTech mark (copied from the brand manual's logo files, never redrawn) with the app name.
 * The colour mark is for light surfaces; on purple, dark or photo backgrounds the manual requires the white mark.
 */
export function Brand({ inverse = false, className }: { inverse?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      {inverse ? (
        <Image src="/brand/sutech-mark-white.svg" alt="" width={36} height={36} className="size-9" />
      ) : (
        <>
          <Image src="/brand/sutech-mark.svg" alt="" width={36} height={36} className="size-9 dark:hidden" />
          <Image src="/brand/sutech-mark-white.svg" alt="" width={36} height={36} className="hidden size-9 dark:block" />
        </>
      )}
      <span className={cn("text-[17px] leading-5 font-extrabold", inverse ? "text-on-brand" : "text-ink-strong")} dir="ltr">
        SUtech <span className={inverse ? "opacity-80" : "text-teal"}>Transport</span>
      </span>
    </span>
  );
}
