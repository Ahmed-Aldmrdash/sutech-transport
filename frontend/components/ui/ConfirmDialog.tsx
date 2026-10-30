"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Banner } from "./Banner";
import { Button } from "./Button";
import { Dialog } from "./Dialog";

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  onConfirm,
  onClose,
  danger = false,
  pending = false,
  error,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  danger?: boolean;
  pending?: boolean;
  error?: string;
}) {
  const t = useTranslations("common");
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      tone={danger ? "danger" : "default"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            {t("cancel")}
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} loading={pending}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-[15px] leading-6">
        {children}
        {error && <Banner tone="danger">{error}</Banner>}
      </div>
    </Dialog>
  );
}
