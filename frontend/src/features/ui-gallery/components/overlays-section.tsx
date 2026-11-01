"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { SelectField } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { GallerySection } from "./gallery-section";

const SAMPLE_LINE_NUMBERS = [1, 2, 3] as const;
const CONFIRM_DELAY_MS = 800;

export function OverlaysSection() {
  const t = useTranslations("gallery");
  const tCommon = useTranslations("common");
  const tPreview = useTranslations("preview");
  const toast = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  function confirm() {
    setIsConfirming(true);
    window.setTimeout(() => {
      setIsConfirming(false);
      setIsConfirmOpen(false);
      toast.show({
        tone: "success",
        title: t("overlays.toastSuccessTitle"),
        description: t("overlays.toastSuccessBody"),
      });
    }, CONFIRM_DELAY_MS);
  }

  return (
    <GallerySection id="overlays" title={t("sections.overlays")}>
      <Card>
        <CardBody className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => setIsDialogOpen(true)}>
            {t("overlays.openDialog")}
          </Button>
          <Button variant="secondary" onClick={() => setIsConfirmOpen(true)}>
            {t("overlays.openConfirm")}
          </Button>
          <Button
            variant="ghost"
            onClick={() =>
              toast.show({
                tone: "success",
                title: t("overlays.toastSuccessTitle"),
                description: t("overlays.toastSuccessBody"),
              })
            }
          >
            {t("overlays.toastSuccess")}
          </Button>
          <Button
            variant="ghost"
            onClick={() =>
              toast.show({
                tone: "danger",
                title: t("overlays.toastErrorTitle"),
                description: t("overlays.toastErrorBody"),
              })
            }
          >
            {t("overlays.toastError")}
          </Button>
          <Button
            variant="ghost"
            onClick={() => toast.show({ tone: "info", title: t("overlays.toastInfoTitle") })}
          >
            {t("overlays.toastInfo")}
          </Button>
        </CardBody>
      </Card>

      <Dialog
        open={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        title={t("overlays.dialogTitle")}
        description={t("overlays.dialogBody")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsDialogOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button onClick={() => setIsDialogOpen(false)}>{tCommon("save")}</Button>
          </>
        }
      >
        <SelectField
          label={t("forms.line")}
          options={SAMPLE_LINE_NUMBERS.map((number) => ({
            value: String(number),
            label: tPreview("lineName", { number }),
          }))}
        />
      </Dialog>

      <ConfirmDialog
        open={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={confirm}
        isConfirming={isConfirming}
        destructive
        title={t("overlays.confirmTitle")}
        description={t("overlays.confirmBody")}
        confirmLabel={t("overlays.confirmAction")}
        cancelLabel={t("overlays.keep")}
      />
    </GallerySection>
  );
}
