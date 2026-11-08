"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Button } from "./button";
import { IconButton } from "./icon-button";

/** Backdrop taps in this first moment are the rest of a double tap, not "close". */
const BACKDROP_GRACE_MS = 500;

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Buttons at the bottom; the main action goes last (end edge). */
  footer?: ReactNode;
  className?: string;
}

/**
 * A modal built on the native <dialog>: focus is trapped, Escape closes it, the page behind is
 * inert. On phones it rises from the bottom like a sheet; on laptops it sits in the centre.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: DialogProps) {
  const t = useTranslations("common");
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  // A double tap on the button that opens the dialog sends its second tap to the new
  // backdrop. Backdrop taps only close it once it has been open a moment, and only when the
  // press also started on the backdrop.
  const openedAt = useRef(0);
  const pressedBackdrop = useRef(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      openedAt.current = performance.now();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onPointerDown={(event) => {
        pressedBackdrop.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        // A click on the backdrop lands on the <dialog> element itself.
        const onBackdrop = event.target === event.currentTarget && pressedBackdrop.current;
        const settled = performance.now() - openedAt.current > BACKDROP_GRACE_MS;
        pressedBackdrop.current = false;
        if (onBackdrop && settled) onClose();
      }}
      className={cn(
        "z-dialog m-0 mt-auto w-full max-w-none rounded-t-lg bg-surface-raised p-0 text-ink shadow-lg",
        "desktop:m-auto desktop:max-w-lg desktop:rounded-lg",
        "max-h-[90dvh] backdrop:backdrop-blur-[2px]",
        className,
      )}
    >
      {open ? (
        <div className="flex max-h-[90dvh] flex-col">
          <div className="flex items-start gap-3 p-5 pb-2">
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-h2 text-ink-strong">
                {title}
              </h2>
              {description ? (
                <p id={descriptionId} className="mt-1 text-body-sm text-ink-muted">
                  {description}
                </p>
              ) : null}
            </div>
            <IconButton
              label={t("close")}
              icon={<X />}
              size="sm"
              className="-me-2 -mt-1"
              onClick={onClose}
            />
          </div>
          {children ? <div className="overflow-y-auto px-5 py-3">{children}</div> : null}
          {footer ? (
            <div className="flex flex-col-reverse gap-2 p-5 pt-3 desktop:flex-row desktop:justify-end">
              {footer}
            </div>
          ) : null}
        </div>
      ) : null}
    </dialog>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: string;
  /** Defaults to "Cancel"; give a clearer one when the action itself is a cancel. */
  cancelLabel?: string;
  /** Red confirm button for destructive actions (cancel subscription, delete). */
  destructive?: boolean;
  isConfirming?: boolean;
  /** Extra fields the confirmation needs (a reason, a note). */
  children?: ReactNode;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = false,
  isConfirming = false,
  children,
}: ConfirmDialogProps) {
  const t = useTranslations("common");
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isConfirming}>
            {cancelLabel ?? t("cancel")}
          </Button>
          <Button
            variant={destructive ? "danger" : "primary"}
            onClick={onConfirm}
            isLoading={isConfirming}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}
