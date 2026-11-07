"use client";

import { CircleCheck, LogOut, Search, Users } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChips } from "@/components/ui/filter-chips";
import { TextField } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Tone } from "@/components/ui/tone";
import { useToast } from "@/components/ui/toast";
import { TripDirection } from "@/features/trips/schema";
import type { Locale } from "@/i18n/routing";
import { formatClockTime, formatNumber, formatTime } from "@/lib/format";
import { useSubmit } from "@/lib/hooks/use-submit";
import { scanRider } from "../api";
import {
  CrewTripStatus,
  RiderState,
  ScanAction,
  ScanMethod,
  type CheckoutReason,
  type CrewToday,
  type CrewTrip,
  type Rider,
} from "../schema";
import { currentTrip, matchesSearch, ridersByStop } from "../trip-rules";
import { CheckoutDialog } from "./checkout-dialog";
import { CrewGate } from "./crew-gate";
import { RiderStateBadge } from "./rider-state-badge";
import { SCAN_ERRORS } from "./scan-page";

const ALL = "all";
type Filter = typeof ALL | RiderState;

/** Everyone on the line for this trip, by stop: who boarded, who's still to come, who's off. */
export function PassengersPage() {
  const t = useTranslations("crew.passengers");
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("lead")} />
      <CrewGate>{(today, refresh) => <PassengersView today={today} refresh={refresh} />}</CrewGate>
    </div>
  );
}

function PassengersView({ today, refresh }: { today: CrewToday; refresh: () => void }) {
  const t = useTranslations("crew.passengers");
  const tTrip = useTranslations("crew.trip");
  const tState = useTranslations("crew.state");
  const locale = useLocale() as Locale;
  const trip = currentTrip(today);
  const [filter, setFilter] = useState<Filter>(ALL);
  const [search, setSearch] = useState("");
  if (!trip) return null;

  const shown = trip.riders.filter(
    (rider) => (filter === ALL || rider.state === filter) && matchesSearch(rider, search),
  );
  const states: RiderState[] =
    trip.status === CrewTripStatus.Ended
      ? [RiderState.Boarded, RiderState.Absent, RiderState.CheckedOut, RiderState.NotGoing]
      : [RiderState.Waiting, RiderState.Boarded, RiderState.NotGoing, RiderState.CheckedOut];
  const countOf = (state: RiderState) =>
    trip.riders.filter((rider) => rider.state === state).length;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-body-sm text-ink-muted">
        {trip.direction === TripDirection.Outbound ? tTrip("outbound") : tTrip("return")} ·{" "}
        {tTrip(`status.${trip.status}`)}
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <FilterChips
          label={t("filterLabel")}
          value={filter}
          onChange={setFilter}
          options={[
            {
              value: ALL,
              label: t("all", { number: formatNumber(trip.riders.length, locale) }),
            },
            ...states.map((state) => ({
              value: state,
              label: `${tState(state)} (${formatNumber(countOf(state), locale)})`,
            })),
          ]}
        />
        <TextField
          label={t("search")}
          type="search"
          autoComplete="off"
          value={search}
          containerClassName="sm:w-72"
          icon={<Search />}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      {shown.length === 0 ? (
        <EmptyState icon={<Users />} title={t("emptyTitle")} description={t("emptyBody")} />
      ) : (
        <div className="flex flex-col gap-4">
          {ridersByStop(shown).map((group) => (
            <Card key={group.order} as="section" aria-label={group.name}>
              <CardBody className="flex flex-col gap-1">
                <h2 className="flex flex-wrap items-baseline gap-x-2 text-body font-bold text-ink-strong">
                  <span>
                    {formatNumber(group.order, locale)}. {group.name}
                  </span>
                  {trip.direction === TripDirection.Outbound && group.riders[0]?.pickup_time ? (
                    <span className="text-caption font-normal text-ink-muted">
                      {formatClockTime(group.riders[0].pickup_time, locale)}
                    </span>
                  ) : null}
                </h2>
                <ul className="flex flex-col">
                  {group.riders.map((rider) => (
                    <RiderRow
                      key={rider.student_id}
                      trip={trip}
                      rider={rider}
                      onChanged={refresh}
                    />
                  ))}
                </ul>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function RiderRow({
  trip,
  rider,
  onChanged,
}: {
  trip: CrewTrip;
  rider: Rider;
  onChanged: () => void;
}) {
  const t = useTranslations("crew.passengers");
  const tScan = useTranslations("crew.scan");
  const tCheckout = useTranslations("crew.checkout");
  const tAbsence = useTranslations("student.notGoing.reasons");
  const locale = useLocale() as Locale;
  const toast = useToast();
  const [dialog, setDialog] = useState<ScanAction | null>(null);
  const { submit, isSending, serverError, clearServerError } = useSubmit(SCAN_ERRORS);
  const running = trip.status === CrewTripStatus.InProgress;
  const canBoard =
    running && (rider.state === RiderState.Waiting || rider.state === RiderState.NotGoing);
  const canCheckout = running && rider.state === RiderState.Boarded;

  async function send(action: ScanAction, reason: CheckoutReason | null, note: string | null) {
    const done = await submit((idempotencyKey) =>
      scanRider(
        trip.trip_id,
        {
          action,
          method: ScanMethod.Manual,
          qr_token: null,
          identifier: rider.identifier,
          reason,
          note,
        },
        { idempotencyKey },
      ),
    );
    if (done) {
      setDialog(null);
      toast.show({
        title:
          action === ScanAction.Board
            ? tScan("boardedResult", { name: rider.name })
            : tScan("checkedOutResult", { name: rider.name }),
        tone: Tone.Success,
      });
      onChanged();
    }
  }

  let detail: string | null = null;
  if (rider.state === RiderState.Boarded && rider.boarded_at) {
    detail = t("boardedAt", { time: formatTime(rider.boarded_at, locale) });
    if (rider.scan_method === ScanMethod.Manual) detail += ` · ${t("manual")}`;
  } else if (rider.state === RiderState.CheckedOut && rider.checked_out_at) {
    const reason = rider.checkout_reason ? tCheckout(`reasons.${rider.checkout_reason}`) : "";
    detail = `${t("leftAt", { time: formatTime(rider.checked_out_at, locale) })} · ${rider.checkout_note ?? reason}`;
  } else if (rider.state === RiderState.NotGoing && rider.not_going_reason) {
    detail = tAbsence(rider.not_going_reason);
  }

  const errorText = serverError ? tScan(`errors.${serverError}`) : null;
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line py-3 first:border-t-0">
      <div className="min-w-0 basis-full sm:flex-1 sm:basis-auto">
        <p className="text-body-sm font-bold text-ink-strong">{rider.name}</p>
        <p className="text-caption text-ink-muted">
          <bdi>{rider.identifier}</bdi>
          {detail ? ` · ${detail}` : ""}
        </p>
      </div>
      <RiderStateBadge state={rider.state} />
      <span className="flex-1 sm:hidden" aria-hidden="true" />
      {canBoard ? (
        <Button
          size="sm"
          variant="secondary"
          iconStart={<CircleCheck className="size-4" />}
          aria-label={t("boardNamed", { name: rider.name })}
          onClick={() => {
            clearServerError();
            setDialog(ScanAction.Board);
          }}
        >
          {t("board")}
        </Button>
      ) : null}
      {canCheckout ? (
        <Button
          size="sm"
          variant="secondary"
          iconStart={<LogOut className="size-4" />}
          aria-label={t("checkoutNamed", { name: rider.name })}
          onClick={() => {
            clearServerError();
            setDialog(ScanAction.Checkout);
          }}
        >
          {t("checkout")}
        </Button>
      ) : null}
      {errorText && dialog === null ? (
        <Alert tone={Tone.Danger} title={errorText} className="w-full" />
      ) : null}
      <ConfirmDialog
        open={dialog === ScanAction.Board}
        onClose={() => setDialog(null)}
        onConfirm={() => void send(ScanAction.Board, null, null)}
        isConfirming={isSending}
        title={t("boardConfirm", { name: rider.name })}
        description={t("boardConfirmBody")}
        confirmLabel={t("board")}
      >
        {errorText ? <Alert tone={Tone.Danger} title={errorText} /> : null}
      </ConfirmDialog>
      <CheckoutDialog
        open={dialog === ScanAction.Checkout}
        riderName={rider.name}
        isSending={isSending}
        error={errorText}
        onClose={() => setDialog(null)}
        onConfirm={(reason, note) => void send(ScanAction.Checkout, reason, note)}
      />
    </li>
  );
}
