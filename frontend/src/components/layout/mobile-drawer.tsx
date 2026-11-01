"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, type ReactNode } from "react";
import { IconButton } from "@/components/ui/icon-button";

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
  header: ReactNode;
  children: ReactNode;
}

/** The phone menu: slides in from the start edge (right in Arabic). Built on native <dialog>. */
export function MobileDrawer({ open, onClose, header, children }: MobileDrawerProps) {
  const t = useTranslations("common");
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={t("menu")}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="z-sheet m-0 h-dvh max-h-none w-[min(20rem,85vw)] max-w-none bg-surface-raised p-0 text-ink shadow-lg desktop:hidden"
      style={{ insetInlineStart: 0, insetInlineEnd: "auto" }}
    >
      <div className="flex h-full flex-col">
        <div className="flex h-app-bar shrink-0 items-center justify-between gap-2 border-b border-line ps-4 pe-2">
          {header}
          <IconButton label={t("closeMenu")} icon={<X />} size="sm" onClick={onClose} />
        </div>
        <nav aria-label={t("mainNavigation")} className="flex-1 overflow-y-auto p-3">
          {children}
        </nav>
      </div>
    </dialog>
  );
}
