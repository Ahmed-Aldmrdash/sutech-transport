import { findMockAccountById } from "@/features/auth/mock-accounts";
import {
  crewProgress,
  crewTripStatus,
  mockRidersOf,
  requireMockCrew,
  requireOwnTrip,
  riderStateOf,
  saveCrewTrip,
} from "@/features/crew/mock-state";
import { CrewTripStatus, RiderState } from "@/features/crew/schema";
import { localized } from "@/features/lines/mock-builders";
import { newMockId } from "@/features/subscriptions/mock-state";
import { pointAlong } from "@/features/tracking/geo";
import { mockPathOf } from "@/features/tracking/mock-geo";
import { TripDirection } from "@/features/trips/schema";
import { ServerErrorCode } from "@/lib/api/errors";
import { MockHttpError, registerMock } from "@/lib/api/mock/mock-server";
import { Role } from "@/lib/auth/roles";
import { createSosEndpoint, getSosEndpoint } from "./api";
import { MOCK_OFFICE_RESPONDER, findSos, saveSos, sosProgress, type MockSos } from "./mock-state";
import { SosErrorCode, type Sos } from "./schema";

const HTTP = { NotFound: 404, Conflict: 409 };
/** The bus's GPS device reports every few seconds. */
const GPS_LAG_MS = 3000;

function toSos(sos: MockSos, language: string, now: number): Sos {
  const raiser = findMockAccountById(sos.raisedBy)?.user;
  const progress = sosProgress(sos, now);
  return {
    id: sos.id,
    type: sos.type,
    status: progress.status,
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
    actions: progress.actions.map((entry) => ({
      action: entry.action,
      by: entry.by,
      by_name: localized(language, MOCK_OFFICE_RESPONDER.nameAr, MOCK_OFFICE_RESPONDER.nameEn),
      at: new Date(entry.at).toISOString(),
      note: null,
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
  if (repeated) return toSos(repeated, language, now);

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
  const sos: MockSos = {
    id: newMockId("sos"),
    type: body.type,
    note: body.note,
    tripId: trip.tripId,
    lineId: line.lineId,
    raisedBy: account.user.id,
    location: { ...point, fixAt: now - GPS_LAG_MS },
    ridersOnBoard: onBoard,
    createdAt: now,
    idempotencyKey: idempotencyKey ?? null,
  };
  saveSos(sos);
  saveCrewTrip({ ...trip, sosIds: [...trip.sosIds, sos.id] });
  return toSos(sos, language, now);
});

registerMock(getSosEndpoint, ({ params }, { token, language }) => {
  const { line } = requireMockCrew(token);
  const sos = findSos(params.sos_id);
  if (!sos || sos.lineId !== line.lineId) {
    throw new MockHttpError(HTTP.NotFound, ServerErrorCode.NotFound, "No such SOS.");
  }
  return toSos(sos, language, Date.now());
});
