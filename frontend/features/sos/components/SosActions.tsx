"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useCanEdit } from "@/components/layout/RequirePage";
import { useMe } from "@/components/providers/SessionProvider";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { useErrorMessage } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { Role } from "@/features/auth/roles";
import { listBuses } from "@/features/fleet/api";
import { useApi, useMutation } from "@/lib/api/use-api";
import { actOnSos, replaceBus } from "../api";
import type { Sos } from "../schema";

/** Acknowledge → (ambulance / notes / replacement bus) → close with what happened. */
export function SosActions({ sos }: { sos: Sos }) {
  const t = useTranslations("admin.sos");
  const toast = useToast();
  const me = useMe();
  const canEdit = useCanEdit();
  const [note, setNote] = useState("");
  const act = useMutation(actOnSos);
  const error = useErrorMessage(act.error);
  if (sos.status === "closed" || !canEdit) return null;

  const run = async (action: Parameters<typeof actOnSos>[1], done: string) => {
    if (await act.run(sos.id, action)) {
      setNote("");
      toast(done);
    }
  };
  const canReplace = sos.kind !== "medical" && (me.role === Role.SuperAdmin || me.role === Role.TransportAdmin);

  return (
    <div className="flex flex-col gap-3">
      {sos.status === "new" ? (
        <Button variant="danger" loading={act.pending} onClick={() => run({ action: "acknowledge" }, t("acknowledged"))}>
          {t("acknowledge")}
        </Button>
      ) : (
        <>
          {!sos.ambulance_requested && (
            <Button variant="secondary" loading={act.pending} onClick={() => run({ action: "request_ambulance" }, t("ambulanceRequested"))}>
              {t("requestAmbulance")}
            </Button>
          )}
          <Field label={t("note")} hint={t("noteHint")}>
            {(props) => <Textarea {...props} value={note} maxLength={300} onChange={(event) => setNote(event.target.value)} />}
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={note.trim().length < 3} loading={act.pending} onClick={() => run({ action: "note", note: note.trim() }, t("noted"))}>
              {t("addNote")}
            </Button>
            <Button disabled={note.trim().length < 3} loading={act.pending} onClick={() => run({ action: "close", note: note.trim() }, t("closed"))}>
              {t("close")}
            </Button>
          </div>
          {canReplace && <Replacement sos={sos} />}
        </>
      )}
      {error && <Banner tone="danger">{error}</Banner>}
    </div>
  );
}

function Replacement({ sos }: { sos: Sos }) {
  const t = useTranslations("admin.sos");
  const toast = useToast();
  const buses = useApi(listBuses);
  const [busId, setBusId] = useState("");
  const [reason, setReason] = useState("");
  const replace = useMutation(replaceBus);
  const error = useErrorMessage(replace.error);
  const free = (buses.data ?? []).filter((bus) => !bus.line_id && bus.status === "ok" && bus.driver_name);
  return (
    <div className="flex flex-col gap-3 rounded-md border border-line p-3">
      <p className="font-bold">{t("replacementTitle")}</p>
      {free.length === 0 ? (
        <p className="text-[14px] text-ink-muted">{t("noFreeBus")}</p>
      ) : (
        <>
          <Field label={t("bus")}>
            {(props) => (
              <Select {...props} value={busId} onChange={(event) => setBusId(event.target.value)}>
                <option value="">{t("chooseBus")}</option>
                {free.map((bus) => (
                  <option key={bus.id} value={bus.id}>
                    {bus.plate} · {bus.driver_name} · {bus.capacity}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t("reason")}>{(props) => <Input {...props} value={reason} maxLength={200} onChange={(event) => setReason(event.target.value)} />}</Field>
          {error && <Banner tone="danger">{error}</Banner>}
          <Button
            variant="teal"
            disabled={!busId || reason.trim().length < 3}
            loading={replace.pending}
            onClick={async () => {
              if (await replace.run(sos.trip_id, busId, reason.trim())) toast(t("replaced"));
            }}
          >
            {t("sendReplacement")}
          </Button>
        </>
      )}
    </div>
  );
}
