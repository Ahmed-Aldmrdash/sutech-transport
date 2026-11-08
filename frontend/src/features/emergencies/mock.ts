import { requireMockAccount } from "@/features/auth/mock-token";
import {
  crewFleetOf,
  crewTripStatus,
  crewTripsOn,
  findCrewTrip,
  mockRidersOf,
  riderStateOf,
  saveCrewTrip,
  type MockCrewTrip,
  type MockReplacement,
} from "@/features/crew/mock-state";
import { CrewTripStatus, RiderState } from "@/features/crew/schema";
import {
  MOCK_SEATS_BY_BUS,
  findMockLine,
  localized,
  toLineSummary,
} from "@/features/lines/mock-builders";
import {
  MOCK_SPARE_BUSES,
  MOCK_SPARE_DRIVER_IDS,
  mockFleetBus,
  mockFleetDriver,
  type MockFleetBus,
  type MockFleetDriver,
} from "@/features/lines/mock-fleet";
import type { MockLineSource } from "@/features/lines/mock-lines";
import { findMockAccountById } from "@/features/auth/mock-accounts";
import { mockUserName, toSos } from "@/features/sos/mock";
import {
  addSosAction,
  allSos,
  findSos,
  sosStatusOf,
  type MockSos,
} from "@/features/sos/mock-state";
import { SosAction, SosStatus, SosType } from "@/features/sos/schema";
import { newMockId } from "@/features/subscriptions/mock-state";
import { MOCK_CAMPUS } from "@/features/tracking/mock-geo";
import { ServerErrorCode } from "@/lib/api/errors";
import { cairoNow } from "@/lib/api/mock/cairo-clock";
import { MockHttpError, registerMock } from "@/lib/api/mock/mock-server";
import { Role } from "@/lib/auth/roles";
import {
  addSosActionEndpoint,
  getAdminSosEndpoint,
  getReplacementOptionsEndpoint,
  listAdminSosEndpoint,
  sendReplacementEndpoint,
} from "./api";
import {
  EmergencyErrorCode,
  type AdminSos,
  type FleetBus,
  type FleetDriver,
  type TripReplacement,
} from "./schema";

const HTTP = { Forbidden: 403, NotFound: 404, Conflict: 409, Unprocessable: 422 };
/** The clinic follows medical alerts and accidents, never a breakdown. */
const CLINIC_TYPES: readonly SosType[] = [SosType.Medical, SosType.Accident];

function requireOffice(token: string | null, roles: readonly Role[]) {
  const account = requireMockAccount(token);
  if (account.user.role !== Role.SuperAdmin && !roles.includes(account.user.role)) {
    throw new MockHttpError(HTTP.Forbidden, ServerErrorCode.Forbidden, "Not your office.");
  }
  return account;
}

const requireSosDesk = (token: string | null) =>
  requireOffice(token, [Role.Transport, Role.Clinic]);

function visibleTo(role: Role, sos: MockSos): boolean {
  return role !== Role.Clinic || CLINIC_TYPES.includes(sos.type);
}

function notFound(): never {
  throw new MockHttpError(HTTP.NotFound, ServerErrorCode.NotFound, "No such SOS.");
}

function conflict(code: EmergencyErrorCode, message: string): never {
  throw new MockHttpError(HTTP.Conflict, code, message);
}

function toFleetBus(bus: MockFleetBus): FleetBus {
  return {
    bus_id: bus.busId,
    bus_type: bus.busType,
    plate: bus.plate,
    seats: MOCK_SEATS_BY_BUS[bus.busType],
  };
}

function toFleetDriver(driver: MockFleetDriver, language: string): FleetDriver {
  return {
    driver_id: driver.driverId,
    name: localized(language, driver.nameAr, driver.nameEn),
    phone: driver.phone,
  };
}

function toReplacement(replacement: MockReplacement, language: string): TripReplacement {
  const bus = mockFleetBus(replacement.busId);
  const driver = mockFleetDriver(replacement.driverId);
  if (!bus || !driver) throw new Error(`Unknown fleet in ${replacement.replacementId}`);
  return {
    replacement_id: replacement.replacementId,
    bus: toFleetBus(bus),
    driver: toFleetDriver(driver, language),
    reason: replacement.reason,
    note: replacement.note,
    sos_id: replacement.sosId,
    by_name: mockUserName(replacement.by, language),
    at: new Date(replacement.at).toISOString(),
  };
}

function lineAndTripOf(sos: MockSos): { line: MockLineSource; trip: MockCrewTrip } {
  const line = findMockLine(sos.lineId);
  const trip = findCrewTrip(sos.tripId);
  if (!line || !trip) throw new Error(`Broken SOS ${sos.id}`);
  return { line, trip };
}

function toAdminSos(sos: MockSos, language: string): AdminSos {
  const { line, trip } = lineAndTripOf(sos);
  const fleet = crewFleetOf(trip, line);
  return {
    ...toSos(sos, language),
    bus_id: fleet.bus.busId,
    line: toLineSummary(line, language),
    direction: trip.direction,
    bus: toFleetBus(fleet.bus),
    driver: toFleetDriver(fleet.driver, language),
    raised_by_phone: findMockAccountById(sos.raisedBy)?.phone ?? null,
    replacements: (trip.replacements ?? []).map((item) => toReplacement(item, language)),
    campus_location: MOCK_CAMPUS,
  };
}

function requireVisibleSos(sosId: string, role: Role): MockSos {
  const sos = findSos(sosId);
  if (!sos || !visibleTo(role, sos)) notFound();
  return sos;
}

registerMock(listAdminSosEndpoint, ({ query }, { token, language }) => {
  const { user } = requireSosDesk(token);
  const items = allSos()
    .filter((sos) => visibleTo(user.role, sos))
    .filter((sos) => !query.status || sosStatusOf(sos) === query.status)
    .map((sos) => toAdminSos(sos, language));
  return { items };
});

registerMock(getAdminSosEndpoint, ({ params }, { token, language }) => {
  const { user } = requireSosDesk(token);
  return toAdminSos(requireVisibleSos(params.sos_id, user.role), language);
});

registerMock(addSosActionEndpoint, ({ params, body }, { token, language }) => {
  const { user } = requireSosDesk(token);
  const sos = requireVisibleSos(params.sos_id, user.role);
  const status = sosStatusOf(sos);
  if (status === SosStatus.Closed) conflict(EmergencyErrorCode.SosClosed, "Already closed.");
  if (body.action === SosAction.Acknowledge) {
    if (status !== SosStatus.Open) {
      conflict(EmergencyErrorCode.AlreadyAcknowledged, "Someone already took it.");
    }
  } else if (status === SosStatus.Open) {
    conflict(EmergencyErrorCode.NotAcknowledged, "Take the alert first.");
  }
  const note = body.note?.trim() || null;
  if ((body.action === SosAction.Note || body.action === SosAction.Close) && !note) {
    throw new MockHttpError(HTTP.Unprocessable, EmergencyErrorCode.NoteRequired, "Note?");
  }
  const updated = addSosAction(sos, { action: body.action, by: user.id, at: Date.now(), note });
  return toAdminSos(updated, language);
});

/** Buses and drivers already sent to another trip today that hasn't ended. */
function busyFleet(date: string, exceptTripId: string) {
  const busy = { buses: new Set<string>(), drivers: new Set<string>() };
  for (const trip of crewTripsOn(date)) {
    const last = trip.replacements?.at(-1);
    if (!last || trip.tripId === exceptTripId || crewTripStatus(trip) === CrewTripStatus.Ended) {
      continue;
    }
    busy.buses.add(last.busId);
    busy.drivers.add(last.driverId);
  }
  return busy;
}

function requireTodayTrip(tripId: string, now: number) {
  const trip = findCrewTrip(tripId);
  const line = trip ? findMockLine(trip.lineId) : undefined;
  if (!trip || !line || trip.date !== cairoNow(new Date(now)).date) {
    throw new MockHttpError(HTTP.NotFound, ServerErrorCode.NotFound, "No such trip today.");
  }
  return { trip, line };
}

registerMock(getReplacementOptionsEndpoint, ({ params }, { token, language }) => {
  requireOffice(token, [Role.Transport]);
  const now = Date.now();
  const { trip, line } = requireTodayTrip(params.trip_id, now);
  const fleet = crewFleetOf(trip, line);
  const busy = busyFleet(trip.date, trip.tripId);
  const riders = mockRidersOf(line).filter(
    (rider) => riderStateOf(trip, line, rider, now).state !== RiderState.NotGoing,
  ).length;
  const buses = MOCK_SPARE_BUSES.filter(
    (bus) =>
      bus.busId !== fleet.bus.busId &&
      !busy.buses.has(bus.busId) &&
      !busy.drivers.has(bus.driverId),
  ).flatMap((bus) => {
    const driver = mockFleetDriver(bus.driverId);
    return driver ? [{ ...toFleetBus(bus), driver: toFleetDriver(driver, language) }] : [];
  });
  const drivers = MOCK_SPARE_DRIVER_IDS.filter(
    (id) => id !== fleet.driver.driverId && !busy.drivers.has(id),
  ).flatMap((id) => {
    const driver = mockFleetDriver(id);
    return driver ? [toFleetDriver(driver, language)] : [];
  });
  return {
    trip_id: trip.tripId,
    line: toLineSummary(line, language),
    bus: toFleetBus(fleet.bus),
    driver: toFleetDriver(fleet.driver, language),
    riders,
    buses,
    drivers,
  };
});

registerMock(sendReplacementEndpoint, ({ params, body }, { token, language }) => {
  const account = requireOffice(token, [Role.Transport]);
  const now = Date.now();
  const { trip, line } = requireTodayTrip(params.trip_id, now);
  if (crewTripStatus(trip) === CrewTripStatus.Ended) {
    conflict(EmergencyErrorCode.TripAlreadyEnded, "The trip ended.");
  }
  const sos = body.sos_id ? findSos(body.sos_id) : undefined;
  if (body.sos_id && (!sos || sos.tripId !== trip.tripId)) notFound();
  if (sos && sosStatusOf(sos) === SosStatus.Closed) {
    conflict(EmergencyErrorCode.SosClosed, "The alert is closed.");
  }

  const current = crewFleetOf(trip, line);
  const busy = busyFleet(trip.date, trip.tripId);
  const spareBus = body.bus_id
    ? MOCK_SPARE_BUSES.find((bus) => bus.busId === body.bus_id)
    : undefined;
  if (body.bus_id && (!spareBus || busy.buses.has(body.bus_id))) {
    conflict(EmergencyErrorCode.BusNotAvailable, "That bus isn't free.");
  }
  const busId = spareBus?.busId ?? current.bus.busId;
  const driverId = body.driver_id ?? spareBus?.driverId ?? current.driver.driverId;
  const spareDrivers = [...MOCK_SPARE_DRIVER_IDS, ...MOCK_SPARE_BUSES.map((bus) => bus.driverId)];
  if (
    body.driver_id &&
    (!spareDrivers.includes(body.driver_id) || busy.drivers.has(body.driver_id))
  ) {
    conflict(EmergencyErrorCode.DriverNotAvailable, "That driver isn't free.");
  }
  if (busId === current.bus.busId && driverId === current.driver.driverId) {
    throw new MockHttpError(HTTP.Unprocessable, EmergencyErrorCode.NothingToChange, "Same crew.");
  }

  const replacement: MockReplacement = {
    replacementId: newMockId("rpl"),
    busId,
    driverId,
    reason: body.reason,
    note: body.note?.trim() || null,
    sosId: sos?.id ?? null,
    by: account.user.id,
    at: now,
  };
  saveCrewTrip({ ...trip, replacements: [...(trip.replacements ?? []), replacement] });
  if (sos) {
    addSosAction(sos, {
      action: SosAction.ReplacementSent,
      by: account.user.id,
      at: now,
      note: replacement.note,
      replacementId: replacement.replacementId,
    });
  }
  return toReplacement(replacement, language);
});
