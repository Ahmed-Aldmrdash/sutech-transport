import { findMockAccountById } from "@/features/auth/mock-accounts";
import {
  crewFleetOf,
  crewProgress,
  crewTripStatus,
  findCrewTrip,
  mockRidersOf,
  requireMockCrew,
  requireOwnTrip,
  riderStateOf,
  saveCrewTrip,
} from "@/features/crew/mock-state";
import { CrewTripStatus, RiderState } from "@/features/crew/schema";
import { localized } from "@/features/lines/mock-builders";
import { mockFleetBus, mockFleetDriver } from "@/features/lines/mock-fleet";
import { newMockId } from "@/features/subscriptions/mock-state";
import { pointAlong } from "@/features/tracking/geo";
import { mockPathOf } from "@/features/tracking/mock-geo";
import { TripDirection } from "@/features/trips/schema";
import { ServerErrorCode } from "@/lib/api/errors";
import { MockHttpError, registerMock } from "@/lib/api/mock/mock-server";
import { Role } from "@/lib/auth/roles";
import { createSosEndpoint, getSosEndpoint } from "./api";
import { actionsOf, findSos, saveSos, sosStatusOf, type MockSos } from "./mock-state";
import { SosErrorCode, type Sos } from "./schema";

const HTTP = { NotFound: 404, Conflict: 409 };
/** The bus's GPS device reports every few seconds. */
const GPS_LAG_MS = 3000;

/** A user's name in the request's language, as the server would send it. */
export function mockUserName(userId: string, language: string): string | null {
  const user = findMockAccountById(userId)?.user;
  return user ? localized(language, user.name_ar ?? user.name, user.name) : null;
}

/** "ن ص ط 7120 · Sayed Abdelhamid", plus the office's note: what the crew is told was sent. */
function replacementText(
  tripId: string,
  replacementId: string,
  note: string | null,
  language: string,
): string | null {
  const replacement = findCrewTrip(tripId)?.replacements?.find(
    (item) => item.replacementId === replacementId,
  );
  const bus = replacement ? mockFleetBus(replacement.busId) : undefined;
  const driver = replacement ? mockFleetDriver(replacement.driverId) : undefined;
  if (!bus || !driver) return note;
  const sent = `${bus.plate} · ${localized(language, driver.nameAr, driver.nameEn)}`;
  return note ? `${sent}. ${note}` : sent;
}

export function toSos(sos: MockSos, language: string): Sos {
  const raiser = findMockAccountById(sos.raisedBy)?.user;
  return {
    id: sos.id,
    type: sos.type,
    status: sosStatusOf(sos),
    note: sos.note,
    trip_id: sos.tripId,
    line_id: sos.lineId,
    bus_id: `bus_${sos.lineId}`,
    raised_by: {
      id: sos.raisedBy,
      role: raiser?.role === Role.Supervisor ? Role.Supervisor : Role.Driver,
      name: raiser ? localized(language, raiser.name_ar ?? raiser.name, raiser.name) : "",
    },
    location: sos.location
      ? {
          lat: sos.location.lat,
          lng: sos.location.lng,
          fix_at: new Date(sos.location.fixAt).toISOString(),
          source: "bus_gps",
        }
      : null,
    riders_on_board: sos.ridersOnBoard,
    created_at: new Date(sos.createdAt).toISOString(),
    actions: actionsOf(sos).map((entry) => ({
      action: entry.action,
      by: entry.by,
      by_name: mockUserName(entry.by, language),
      at: new Date(entry.at).toISOString(),
      note: entry.replacementId
        ? replacementText(sos.tripId, entry.replacementId, entry.note, language)
        : entry.note,
    })),
  };
}

registerMock(createSosEndpoint, ({ body }, { token, language, idempotencyKey }) => {
  const { account, line } = requireMockCrew(token);
  const now = Date.now();
  const trip = requireOwnTrip(line, body.trip_id, now);
  if (crewTripStatus(trip) === CrewTripStatus.Ended) {
    throw new MockHttpError(HTTP.Conflict, SosErrorCode.TripAlreadyEnded, "The trip ended.");
  }
  // Business rule 9: the same press arriving twice makes one SOS.
  const repeated = trip.sosIds
    .map(findSos)
    .find((item) => item && idempotencyKey && item.idempotencyKey === idempotencyKey);
  if (repeated) return toSos(repeated, language);

  // The bus's own GPS device: where it is along the line's road path right now.
  const path = mockPathOf(line.lineId);
  const done = crewProgress(trip, line, now);
  const { point } = pointAlong(
    trip.direction === TripDirection.Outbound ? path : [...path].reverse(),
    done,
  );
  const onBoard = mockRidersOf(line).filter(
    (rider) => riderStateOf(trip, line, rider, now).state === RiderState.Boarded,
  ).length;
  const fleet = crewFleetOf(trip, line);
  const sos: MockSos = {
    id: newMockId("sos"),
    fleet: { busId: fleet.bus.busId, driverId: fleet.driver.driverId },
    type: body.type,
    note: body.note,
    tripId: trip.tripId,
    lineId: line.lineId,
    raisedBy: account.user.id,
    location: { ...point, fixAt: now - GPS_LAG_MS },
    ridersOnBoard: onBoard,
    createdAt: now,
    idempotencyKey: idempotencyKey ?? null,
    actions: [],
  };
  saveSos(sos);
  saveCrewTrip({ ...trip, sosIds: [...trip.sosIds, sos.id] });
  return toSos(sos, language);
});

registerMock(getSosEndpoint, ({ params }, { token, language }) => {
  const { line } = requireMockCrew(token);
  const sos = findSos(params.sos_id);
  if (!sos || sos.lineId !== line.lineId) {
    throw new MockHttpError(HTTP.NotFound, ServerErrorCode.NotFound, "No such SOS.");
  }
  return toSos(sos, language);
});
