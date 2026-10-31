"use client";

import { useState } from "react";
import { Siren } from "lucide-react";
import { useTranslations } from "next-intl";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Textarea } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { useErrorMessage } from "@/components/ui/States";
import { useCrewTrip } from "@/features/trips/components/useCrewTrip";
import { Link, useRouter } from "@/i18n/navigation";
import { useMutation } from "@/lib/api/use-api";
import { raiseSos } from "../api";
import { SosKind } from "../schema";

const FLOAT = "fixed end-4 bottom-[calc(84px+env(safe-area-inset-bottom))] z-30";

/** Always-visible emergency button for the bus crew. One open SOS per trip; while open it links to its status. */
export function SosButton() {
  const t = useTranslations("crew.sos");
  const router = useRouter();
  const trip = useCrewTrip();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<SosKind>(SosKind.Medical);
  const [note, setNote] = useState("");
  const raise = useMutation(raiseSos);
  const error = useErrorMessage(raise.error);
  if (!trip.data) return null;

  if (trip.data.open_sos_id) {
    return (
      <Link href="/driver/sos" className={`${FLOAT} inline-flex min-h-14 items-center gap-2 rounded-full bg-danger px-5 font-extrabold text-on-danger shadow-lg`}>
        <Siren className="size-5 animate-pulse" aria-hidden />
        {t("openStatus")}
      </Link>
    );
  }
  const tripId = trip.data.trip_id;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`${FLOAT} inline-flex size-16 items-center justify-center rounded-full bg-danger text-on-danger shadow-lg`} aria-label={t("button")}>
        <span className="flex flex-col items-center text-[12px] leading-4 font-extrabold">
          <Siren className="size-6" aria-hidden />
          SOS
        </span>
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("title")}
        tone="danger"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={raise.pending}>
              {t("cancel")}
            </Button>
            <Button
              variant="danger"
              loading={raise.pending}
              onClick={async () => {
                if (await raise.run(tripId, kind, note.trim())) {
                  setOpen(false);
                  router.push("/driver/sos");
                }
              }}
            >
              {t("send")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <p>{t("body")}</p>
          <Segmented
            label={t("kind")}
            value={kind}
            onChange={setKind}
            options={Object.values(SosKind).map((value) => ({ value, label: t(`kinds.${value}`) }))}
          />
          <Field label={t("note")} hint={t("noteHint")}>
            {(props) => <Textarea {...props} value={note} maxLength={300} onChange={(event) => setNote(event.target.value)} />}
          </Field>
          {error && <Banner tone="danger">{error}</Banner>}
        </div>
      </Dialog>
    </>
  );
}
