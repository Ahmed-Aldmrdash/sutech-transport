"use client";

import { type ReactNode, useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

/** Modal dialog on the native <dialog> element: focus trap, Escape and backdrop come for free. */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  tone = "default",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  tone?: "default" | "danger";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const t = useTranslations("common");

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className={cn(
        "m-auto w-[min(32rem,calc(100vw-32px))] rounded-lg bg-surface-raised p-0 text-ink shadow-lg",
        "backdrop:bg-overlay",
      )}
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-start justify-between gap-3 border-b border-line p-4">
            <h2 id={titleId} className={cn("text-[20px] leading-7 font-extrabold", tone === "danger" && "text-danger")}>
              {title}
            </h2>
            <button type="button" onClick={onClose} aria-label={t("close")} className="-m-2 rounded-md p-2 text-ink-muted hover:bg-surface-alt">
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <div className="overflow-y-auto p-4">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line p-4">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}
