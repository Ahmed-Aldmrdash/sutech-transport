"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { writeToken } from "@/lib/session";

/** Mock mode only: puts the demo data back to the start and signs out, so a demo can be run again from scratch. */
export function DemoReset() {
  const t = useTranslations("settings.demo");
  const [open, setOpen] = useState(false);

  async function reset() {
    const { resetDb } = await import("@/lib/mock/db");
    resetDb();
    writeToken(null);
    window.location.assign(`/${document.documentElement.lang || "ar"}/login`);
  }

  return (
    <Card>
      <CardTitle>{t("title")}</CardTitle>
      <p className="mb-3 text-ink-muted">{t("body")}</p>
      <Button variant="secondary" icon={<RotateCcw className="size-4" aria-hidden />} onClick={() => setOpen(true)}>
        {t("reset")}
      </Button>
      <ConfirmDialog open={open} title={t("confirmTitle")} confirmLabel={t("reset")} onConfirm={() => void reset()} onClose={() => setOpen(false)}>
        {t("confirmBody")}
      </ConfirmDialog>
    </Card>
  );
}
