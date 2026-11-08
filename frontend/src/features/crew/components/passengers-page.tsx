"use client";

import { Search, Users } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChips } from "@/components/ui/filter-chips";
import { TextField } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { TripDirection } from "@/features/trips/schema";
import type { Locale } from "@/i18n/routing";
import { formatClockTime, formatNumber } from "@/lib/format";
import { CrewTripStatus, RiderState, type CrewToday } from "../schema";
import { currentTrip, matchesSearch, ridersByStop } from "../trip-rules";
import { CrewGate } from "./crew-gate";
import { RiderRow } from "./rider-row";

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
