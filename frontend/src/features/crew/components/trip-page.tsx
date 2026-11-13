"use client";

import { useLocale, useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Tone } from "@/components/ui/tone";
import { SosStatus } from "@/features/sos/schema";
import type { Locale } from "@/i18n/routing";
import { formatPhone, formatServiceDay, formatTime } from "@/lib/format";
import { type CrewToday } from "../schema";
import { currentTrip } from "../trip-rules";
import { CrewGate } from "./crew-gate";
import { BusCard, OtherTripRow } from "./trip-cards";
import { StopsCard } from "./trip-stops-card";
import { CurrentTripCard } from "./current-trip-card";

/** The crew's home: today's bus and trip, start and end, the counts and the quick actions. */
export function TripPage() {
  const t = useTranslations("crew.trip");
  return (
    <CrewGate header={<PageHeader title={t("title")} />}>
      {(today, refresh) => <TripView today={today} refresh={refresh} />}
    </CrewGate>
  );
}

function TripView({ today, refresh }: { today: CrewToday; refresh: () => void }) {
  const t = useTranslations("crew.trip");
  const tRoot = useTranslations();
  const locale = useLocale() as Locale;
  const trip = currentTrip(today);
  const others = today.trips.filter((item) => item.trip_id !== trip?.trip_id);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={`${tRoot(`roles.${today.crew_role}`)} · ${formatServiceDay(today.service_date, locale)}`}
        title={t("title")}
        description={`${tRoot("student.lineCode", { code: today.line.code })} · ${today.line.name}`}
      />
      {trip?.sos && trip.sos.status !== SosStatus.Closed ? (
        <Alert
          tone={Tone.Danger}
          title={t("sosOpenTitle")}
          action={
            <ButtonLink href="/driver/sos" variant="danger" size="sm">
              {t("sosOpenAction")}
            </ButtonLink>
          }
        >
          {t(`sosOpenBody.${trip.sos.status}`)}
        </Alert>
      ) : null}
      {today.relieved ? (
        <Alert tone={Tone.Warning} title={t("relievedTitle")}>
          {t("relievedBody", {
            time: formatTime(today.relieved.at, locale),
            name: today.relieved.driver_name,
            phone: formatPhone(today.relieved.driver_phone),
          })}
        </Alert>
      ) : trip?.replacement ? (
        <Alert tone={Tone.Info} title={t("replacedTitle")}>
          {t("replacedBody", {
            plate: trip.replacement.plate,
            name: trip.replacement.driver_name,
            phone: formatPhone(trip.replacement.driver_phone),
          })}
        </Alert>
      ) : null}
      <div className="grid grid-cols-1 items-start gap-5 desktop:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-5">
          {trip ? <CurrentTripCard today={today} trip={trip} onChanged={refresh} /> : null}
          {others.length > 0 ? (
            <Card>
              <CardHeader title={t("otherTrips")} headingLevel={2} />
              <CardBody className="flex flex-col gap-3">
                {others.map((item) => (
                  <OtherTripRow key={item.trip_id} today={today} trip={item} onChanged={refresh} />
                ))}
              </CardBody>
            </Card>
          ) : null}
        </div>
        <div className="flex flex-col gap-5">
          <BusCard today={today} />
          {trip ? <StopsCard today={today} trip={trip} /> : null}
        </div>
      </div>
    </div>
  );
}
