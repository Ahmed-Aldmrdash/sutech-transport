"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Tone } from "@/components/ui/tone";
import { useToast } from "@/components/ui/toast";
import { cancelSubscription } from "../api";
import type { Subscription } from "../schema";

/** Frees an unpaid reservation so the student can pick another line or stop. */
export function CancelBookingButton({
  subscription,
  onCancelled,
}: {
  subscription: Subscription;
  onCancelled: () => void;
}) {
  const t = useTranslations("student.booking");
  const toast = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  async function confirm() {
    setIsCancelling(true);
    try {
      await cancelSubscription(subscription.subscription_id);
      setIsOpen(false);
      toast.show({ title: t("cancelled"), tone: Tone.Success });
      onCancelled();
    } catch {
      toast.show({ title: t("cancelError"), tone: Tone.Danger });
    } finally {
      setIsCancelling(false);
    }
  }

  return (
    <>
      <Button variant="ghost" onClick={() => setIsOpen(true)}>
        {t("cancel")}
      </Button>
      <ConfirmDialog
        open={isOpen}
        onClose={() => setIsOpen(false)}
        onConfirm={confirm}
        title={t("cancelTitle")}
        description={t("cancelBody", { line: subscription.line.name })}
        confirmLabel={t("cancelConfirm")}
        cancelLabel={t("keep")}
        destructive
        isConfirming={isCancelling}
      />
    </>
  );
}
