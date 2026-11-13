"use client";

import { useTranslations } from "next-intl";
import { Dialog } from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { SosType } from "@/features/sos/schema";
import { AsyncStatus, useAsync } from "@/lib/hooks/use-async";
import { getReplacementOptions } from "../api";
import { ReplacementReason, type TripReplacement } from "../schema";
import { ReplacementForm } from "./replacement-form";

export const Kind = { Bus: "bus", Driver: "driver" } as const;
export type Kind = (typeof Kind)[keyof typeof Kind];

const REASON_FOR_TYPE: Record<SosType, ReplacementReason> = {
  [SosType.Breakdown]: ReplacementReason.Breakdown,
  [SosType.Accident]: ReplacementReason.Accident,
  [SosType.Medical]: ReplacementReason.DriverUnavailable,
};

interface ReplacementDialogProps {
  open: boolean;
  tripId: string;
  /** The alert it answers; null when the office changes a trip's bus or driver on its own. */
  sosId: string | null;
  sosType: SosType | null;
  onClose: () => void;
  onSent: (replacement: TripReplacement) => void;
}

/** Another bus (with its driver) or only another driver, sent to the trip from the alert. */
export function ReplacementDialog(props: ReplacementDialogProps) {
  const t = useTranslations("emergencies.replacementDialog");
  // Mounting the body only while open re-reads who is free each time it opens.
  return (
    <Dialog open={props.open} onClose={props.onClose} title={t("title")}>
      {props.open ? <ReplacementBody {...props} /> : null}
    </Dialog>
  );
}

function ReplacementBody({ tripId, sosId, sosType, onClose, onSent }: ReplacementDialogProps) {
  const options = useAsync((signal) => getReplacementOptions(tripId, { signal }), [tripId]);
  if (options.status === AsyncStatus.Loading) return <Skeleton className="h-64 w-full" />;
  if (options.status === AsyncStatus.Error) {
    return <ErrorState error={options.error} onRetry={options.reload} />;
  }
  return (
    <ReplacementForm
      options={options.data}
      sosId={sosId}
      defaultReason={sosType ? REASON_FOR_TYPE[sosType] : ReplacementReason.Other}
      onClose={onClose}
      onSent={onSent}
    />
  );
}
