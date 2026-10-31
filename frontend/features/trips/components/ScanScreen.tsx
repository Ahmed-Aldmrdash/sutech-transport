"use client";

import { type FormEvent, useState } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { Async } from "@/components/ui/Async";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { useErrorMessage } from "@/components/ui/States";
import { useMutation } from "@/lib/api/use-api";
import { scanCard } from "../api";
import { CheckoutReason, type CrewTrip, type Rider } from "../schema";
import { CameraScanner } from "./CameraScanner";
import { useCrewTrip } from "./useCrewTrip";

type Action = "board" | "checkout";
type Reason = (typeof CheckoutReason)[keyof typeof CheckoutReason];

/** Boarding and mid-trip check-out: scan the student's card, or type their 9-digit ID if the camera can't read. */
export function ScanScreen() {
  const t = useTranslations("crew.scan");
  const query = useCrewTrip();
  return (
    <>
      <PageHeader title={t("title")} back="/driver" backLabel={t("back")} />
      <Async query={query}>{(trip) => (trip.state === "in_progress" ? <Scanner trip={trip} /> : <Banner tone="warning">{t("notStarted")}</Banner>)}</Async>
    </>
  );
}

function Scanner({ trip }: { trip: CrewTrip }) {
  const t = useTranslations("crew.scan");
  const [action, setAction] = useState<Action>("board");
  const [reason, setReason] = useState<Reason>(CheckoutReason.Illness);
  const [manual, setManual] = useState("");
  const [last, setLast] = useState<{ rider: Rider; action: Action } | null>(null);
  const scan = useMutation((card: string) =>
    scanCard(trip.trip_id, action === "board" ? { action, card } : { action, card, reason, note: null }),
  );
  const error = useErrorMessage(scan.error);

  async function submit(card: string) {
    const value = card.trim();
    if (!value) return;
    const result = await scan.run(value);
    if (result) {
      setLast({ rider: result.rider, action });
      setManual("");
      navigator.vibrate?.(80);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Segmented
        label={t("action")}
        value={action}
        onChange={(value) => {
          setAction(value);
          scan.reset();
        }}
        options={[
          { value: "board", label: t("board") },
          { value: "checkout", label: t("checkout") },
        ]}
      />
      {action === "checkout" && (
        <>
          <Banner tone="warning">{t("checkoutWarning")}</Banner>
          <Field label={t("reason")}>
            {(props) => (
              <Select {...props} value={reason} onChange={(event) => setReason(event.target.value as Reason)}>
                {Object.values(CheckoutReason).map((value) => (
                  <option key={value} value={value}>
                    {t(`reasons.${value}`)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </>
      )}
      <CameraScanner paused={scan.pending} onCode={(code) => void submit(code)} />
      <div aria-live="assertive">
        {error && <Banner tone="danger">{error}</Banner>}
        {!error && last && (
          <Banner tone={last.action === "board" ? "success" : "warning"} title={last.rider.name}>
            {last.action === "board" ? t("boarded", { stop: last.rider.stop_name }) : t("checkedOut")}
          </Banner>
        )}
      </div>
      <Card>
        <form
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            void submit(manual);
          }}
          className="flex flex-col gap-3"
        >
          <Field label={t("manual")} hint={t("manualHint")}>
            {(props) => <Input {...props} value={manual} inputMode="numeric" dir="ltr" className="num text-start" onChange={(event) => setManual(event.target.value)} />}
          </Field>
          <Button type="submit" variant={action === "board" ? "teal" : "secondary"} loading={scan.pending} disabled={!manual.trim()}>
            {action === "board" ? t("confirmBoard") : t("confirmCheckout")}
          </Button>
        </form>
      </Card>
    </div>
  );
}
