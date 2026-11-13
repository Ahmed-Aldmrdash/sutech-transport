"use client";

import { Repeat } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Tone } from "@/components/ui/tone";
import { ReplacementDialog } from "@/features/emergencies/components/replacement-dialog";

/**
 * Sends another bus (with its driver) or only another driver to today's trip of a line: a
 * breakdown, a driver off sick, without an SOS. The same flow as the emergencies desk.
 */
export function ChangeCrewButton({
  tripId,
  onChanged,
  size = "md",
}: {
  tripId: string;
  onChanged: () => void;
  size?: "sm" | "md";
}) {
  const t = useTranslations();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" size={size} iconStart={<Repeat />} onClick={() => setOpen(true)}>
        {t("desk.ops.changeCrew")}
      </Button>
      <ReplacementDialog
        open={open}
        tripId={tripId}
        sosId={null}
        sosType={null}
        onClose={() => setOpen(false)}
        onSent={(sent) => {
          setOpen(false);
          toast.show({
            title: t("emergencies.replacementDialog.sent", {
              plate: sent.bus.plate,
              name: sent.driver.name,
            }),
            tone: Tone.Success,
          });
          onChanged();
        }}
      />
    </>
  );
}
