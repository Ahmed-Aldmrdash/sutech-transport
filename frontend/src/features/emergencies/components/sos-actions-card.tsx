"use client";

import { Ambulance, BusFront, CircleCheck, MessageSquareText } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { Tone } from "@/components/ui/tone";
import { SosAction, SosStatus, SosType } from "@/features/sos/schema";
import { type AdminSos, type OfficeSosAction } from "../schema";
import { ReplacementDialog } from "./replacement-dialog";
import { useCanSendReplacement, useIsViewOnly } from "./use-office-role";
import { LogDialog } from "./sos-log-dialog";
/** Types where someone may be hurt, so "ambulance called" is offered. */
const AMBULANCE_TYPES: readonly SosType[] = [SosType.Medical, SosType.Accident];

type Pending = { action: OfficeSosAction } | { action: "replacement" } | null;

/** The office's next steps on a taken alert: ambulance, another bus, a note, closing it. */
export function SosActionsCard({ sos, onChanged }: { sos: AdminSos; onChanged: () => void }) {
  const t = useTranslations("emergencies");
  const toast = useToast();
  const canReplace = useCanSendReplacement();
  const viewOnly = useIsViewOnly();
  const [pending, setPending] = useState<Pending>(null);
  const isTaken = sos.status === SosStatus.Acknowledged;
  const ambulanceLogged = sos.actions.some((entry) => entry.action === SosAction.AmbulanceCalled);
  const action = pending && pending.action !== "replacement" ? pending.action : null;

  function logged() {
    setPending(null);
    toast.show({ title: t("logged"), tone: Tone.Success });
    onChanged();
  }

  if (viewOnly) {
    return (
      <Card elevation="raised">
        <CardHeader title={t("actionsTitle")} headingLevel={2} />
        <CardBody>
          <p className="text-body-sm text-ink-muted">{t("viewOnly")}</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card elevation="raised">
      <CardHeader title={t("actionsTitle")} headingLevel={2} />
      <CardBody className="flex flex-col gap-3">
        {isTaken ? null : <p className="text-body-sm text-ink-muted">{t("takeFirst")}</p>}
        {AMBULANCE_TYPES.includes(sos.type) && !ambulanceLogged ? (
          <Button
            variant="secondary"
            disabled={!isTaken}
            iconStart={<Ambulance className="size-5" />}
            onClick={() => setPending({ action: SosAction.AmbulanceCalled })}
          >
            {t("ambulance")}
          </Button>
        ) : null}
        {canReplace ? (
          <Button
            variant="secondary"
            disabled={!isTaken}
            iconStart={<BusFront className="size-5" />}
            onClick={() => setPending({ action: "replacement" })}
          >
            {t("replacement")}
          </Button>
        ) : (
          <p className="text-caption text-ink-muted">{t("clinicNote")}</p>
        )}
        <Button
          variant="secondary"
          disabled={!isTaken}
          iconStart={<MessageSquareText className="size-5" />}
          onClick={() => setPending({ action: SosAction.Note })}
        >
          {t("addNote")}
        </Button>
        <Button
          disabled={!isTaken}
          iconStart={<CircleCheck className="size-5" />}
          onClick={() => setPending({ action: SosAction.Close })}
        >
          {t("close")}
        </Button>
      </CardBody>

      {action ? (
        <LogDialog
          key={action}
          sosId={sos.id}
          action={action}
          onClose={() => setPending(null)}
          onLogged={logged}
        />
      ) : null}
      {canReplace ? (
        <ReplacementDialog
          open={pending?.action === "replacement"}
          tripId={sos.trip_id}
          sosId={sos.id}
          sosType={sos.type}
          onClose={() => setPending(null)}
          onSent={(sent) => {
            setPending(null);
            toast.show({
              title: t("replacementDialog.sent", { plate: sent.bus.plate, name: sent.driver.name }),
              tone: Tone.Success,
            });
            onChanged();
          }}
        />
      ) : null}
    </Card>
  );
}
