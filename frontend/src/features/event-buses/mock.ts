import { mockNameOf, requireMockOffice } from "@/features/auth/mock-token";
import { allReplacements } from "@/features/crew/mock-state";
import {
  MOCK_SEATS_BY_BUS,
  findMockLine,
  localized,
  toLineSummary,
} from "@/features/lines/mock-builders";
import {
  MOCK_SPARE_BUSES,
  lineBusId,
  mockFleetBus,
  mockFleetDriver,
  type MockFleetBus,
} from "@/features/lines/mock-fleet";
import { MOCK_LINES, type MockLineSource } from "@/features/lines/mock-lines";
import { ServerErrorCode } from "@/lib/api/errors";
import { addDays, cairoNow } from "@/lib/api/mock/cairo-clock";
import { MockHttpError, registerMock } from "@/lib/api/mock/mock-server";
import { Role } from "@/lib/auth/roles";
import {
  cancelEventEndpoint,
  createEventEndpoint,
  getCompanyRequestEndpoint,
  getEventEndpoint,
  getFleetEndpoint,
  listCompanyRequestsEndpoint,
  listEventsEndpoint,
  replyToRequestEndpoint,
} from "./api";
import {
  allMockEvents,
  findMockEvent,
  nextEventNumber,
  saveMockEvent,
  typed,
  type MockBusEvent,
  type Name,
} from "./mock-state";
import {
  EVENT_DAYS_AHEAD_MAX,
  EVENT_REASON_MIN_LENGTH,
  EventAction,
  EventErrorCode,
  EventStatus,
  FleetBusState,
  type BusEvent,
  type EventBus,
  type EventList,
  type EventListQuery,
  type FleetBus,
} from "./schema";

const HTTP = { NotFound: 404, Conflict: 409, Unprocessable: 422 };
const DEFAULT_PAGE_SIZE = 20;
const OFFICE = [Role.Transport];
const COMPANY = [Role.BusCompany];

/** Which side is asking: the office acts on its requests, the company answers them. */
const Side = { Office: "office", Company: "company" } as const;
type Side = (typeof Side)[keyof typeof Side];

const iso = (time: number) => new Date(time).toISOString();
const todayOf = (now: number) => cairoNow(new Date(now)).date;

function fail(status: number, code: string, message: string): never {
  throw new MockHttpError(status, code, message);
}

// ---------------------------------------------------------------------------------------------
// The fleet: every line's bus and the spares, all Abu El Hol's

interface FleetEntry {
  bus: MockFleetBus;
  line: MockLineSource | null;
}

function fleet(): FleetEntry[] {
  const seen = new Set<string>();
  const entries: FleetEntry[] = [];
  for (const line of MOCK_LINES) {
    const bus = mockFleetBus(lineBusId(line.lineId));
    // Two routes of one line can share a bus: list each plate once.
    if (!bus || seen.has(bus.plate)) continue;
    seen.add(bus.plate);
    entries.push({ bus, line });
  }
  return [...entries, ...MOCK_SPARE_BUSES.map((bus) => ({ bus, line: null }))];
}

function toEventBus(bus: MockFleetBus, language: string): EventBus {
  const driver = mockFleetDriver(bus.driverId);
  return {
    bus_id: bus.busId,
    plate: bus.plate,
    bus_type: bus.busType,
    seats: MOCK_SEATS_BY_BUS[bus.busType],
    driver_name: driver ? localized(language, driver.nameAr, driver.nameEn) : "",
    driver_phone: driver?.phone ?? "",
  };
}

/** Buses already sent to another confirmed event that day. */
function busesTakenOn(date: string, exceptEventId: string, now: number): Set<string> {
  return new Set(
    allMockEvents(now)
      .filter(
        (item) =>
          item.eventId !== exceptEventId &&
          item.eventDate === date &&
          item.status === EventStatus.Confirmed,
      )
      .flatMap((item) => item.reply?.busIds ?? []),
  );
}

// ---------------------------------------------------------------------------------------------
// Shapes

function isPast(item: MockBusEvent, now: number): boolean {
  return item.eventDate < todayOf(now);
}

function allowedActions(item: MockBusEvent, side: Side, now: number): BusEvent["allowed_actions"] {
  if (isPast(item, now)) return [];
  if (side === Side.Company) {
    return item.status === EventStatus.WaitingCompany
      ? [EventAction.Confirm, EventAction.Decline]
      : [];
  }
  return item.status === EventStatus.WaitingCompany || item.status === EventStatus.Confirmed
    ? [EventAction.Cancel]
    : [];
}

function toBusEvent(item: MockBusEvent, side: Side, language: string, now: number): BusEvent {
  const text = (value: Name) => localized(language, value.ar, value.en);
  const optional = (value: Name | null) => (value ? text(value) : null);
  return {
    event_id: item.eventId,
    reference: `EVT-${String(item.number).padStart(4, "0")}`,
    kind: item.kind,
    title: text(item.title),
    event_date: item.eventDate,
    departs_at: item.departsAt,
    returns_at: item.returnsAt,
    pickup: text(item.pickup),
    destination: text(item.destination),
    students_count: item.studentsCount,
    bus_type: item.busType,
    buses_requested: item.busesRequested,
    seats_requested: item.busesRequested * MOCK_SEATS_BY_BUS[item.busType],
    note: optional(item.note),
    status: item.status,
    is_past: isPast(item, now),
    requested_by_name: text(item.requestedBy),
    created_at: iso(item.createdAt),
    company_reply: item.reply
      ? {
          buses: item.reply.busIds
            .map((busId) => mockFleetBus(busId))
            .filter((bus): bus is MockFleetBus => Boolean(bus))
            .map((bus) => toEventBus(bus, language)),
          note: optional(item.reply.note),
          by_name: text(item.reply.by),
          at: iso(item.reply.at),
        }
      : null,
    cancellation: item.cancellation
      ? {
          reason: text(item.cancellation.reason),
          by_name: text(item.cancellation.by),
          at: iso(item.cancellation.at),
        }
      : null,
    allowed_actions: allowedActions(item, side, now),
  };
}

/** Waiting (soonest first), then coming days (soonest first), then the rest (newest first). */
function queueRank(item: MockBusEvent, now: number): number {
  if (isPast(item, now)) return 2;
  if (item.status === EventStatus.WaitingCompany) return 0;
  return item.status === EventStatus.Confirmed ? 1 : 2;
}

function byQueue(now: number) {
  return (a: MockBusEvent, b: MockBusEvent) => {
    const rank = queueRank(a, now) - queueRank(b, now);
    if (rank !== 0) return rank;
    const byDate = a.eventDate.localeCompare(b.eventDate);
    return queueRank(a, now) === 2 ? -byDate : byDate;
  };
}

function listFor(query: EventListQuery, side: Side, language: string, now: number): EventList {
  const all = allMockEvents(now);
  const counts = { waiting_company: 0, confirmed: 0, declined: 0, cancelled: 0 };
  for (const item of all) counts[item.status] += 1;
  const filtered = all
    .filter((item) => !query.status || item.status === query.status)
    .sort(byQueue(now));
  const page = query.page ?? 1;
  const pageSize = query.page_size ?? DEFAULT_PAGE_SIZE;
  return {
    items: filtered
      .slice((page - 1) * pageSize, page * pageSize)
      .map((item) => toBusEvent(item, side, language, now)),
    total: filtered.length,
    counts,
  };
}

function requireEvent(eventId: string, now: number): MockBusEvent {
  return (
    findMockEvent(eventId, now) ??
    fail(HTTP.NotFound, ServerErrorCode.NotFound, "No such event request.")
  );
}

// ---------------------------------------------------------------------------------------------
// The Transportation office

registerMock(listEventsEndpoint, ({ query }, { token, language }) => {
  requireMockOffice(token, OFFICE);
  return listFor(query, Side.Office, language, Date.now());
});

registerMock(getEventEndpoint, ({ params }, { token, language }) => {
  requireMockOffice(token, OFFICE);
  const now = Date.now();
  return toBusEvent(requireEvent(params.event_id, now), Side.Office, language, now);
});

registerMock(createEventEndpoint, ({ body }, { token, language }) => {
  const officer = requireMockOffice(token, OFFICE);
  const now = Date.now();
  const today = todayOf(now);
  if (body.event_date <= today || body.event_date > addDays(today, EVENT_DAYS_AHEAD_MAX)) {
    fail(HTTP.Unprocessable, EventErrorCode.DateInvalid, "Pick a day from tomorrow on.");
  }
  if (body.returns_at !== null && body.returns_at <= body.departs_at) {
    fail(HTTP.Unprocessable, EventErrorCode.TimesInvalid, "The return must be after leaving.");
  }
  if (body.buses_requested * MOCK_SEATS_BY_BUS[body.bus_type] < body.students_count) {
    fail(HTTP.Unprocessable, EventErrorCode.NotEnoughSeats, "Not enough seats.");
  }
  const title = body.title.trim().toLowerCase();
  const duplicate = allMockEvents(now).some(
    (item) =>
      item.eventDate === body.event_date &&
      (item.status === EventStatus.WaitingCompany || item.status === EventStatus.Confirmed) &&
      [item.title.ar, item.title.en].some((value) => value.trim().toLowerCase() === title),
  );
  if (duplicate) {
    fail(HTTP.Conflict, EventErrorCode.Duplicate, "This event is already asked for that day.");
  }
  const number = nextEventNumber(now);
  const created: MockBusEvent = {
    eventId: `evt_${number}_${now.toString(36)}`,
    number,
    kind: body.kind,
    title: typed(body.title.trim()),
    eventDate: body.event_date,
    departsAt: body.departs_at,
    returnsAt: body.returns_at,
    pickup: typed(body.pickup.trim()),
    destination: typed(body.destination.trim()),
    studentsCount: body.students_count,
    busType: body.bus_type,
    busesRequested: body.buses_requested,
    note: body.note?.trim() ? typed(body.note.trim()) : null,
    status: EventStatus.WaitingCompany,
    requestedBy: mockNameOf(officer),
    createdAt: now,
    reply: null,
    cancellation: null,
  };
  saveMockEvent(created);
  return toBusEvent(created, Side.Office, language, now);
});

registerMock(cancelEventEndpoint, ({ params, body }, { token, language }) => {
  const officer = requireMockOffice(token, OFFICE);
  const now = Date.now();
  const item = requireEvent(params.event_id, now);
  if (!allowedActions(item, Side.Office, now).includes(EventAction.Cancel)) {
    fail(HTTP.Conflict, EventErrorCode.Closed, "This request can't be cancelled any more.");
  }
  const reason = body.reason.trim();
  if (reason.length < EVENT_REASON_MIN_LENGTH) {
    fail(HTTP.Unprocessable, EventErrorCode.ReasonRequired, "Write the reason.");
  }
  const updated: MockBusEvent = {
    ...item,
    status: EventStatus.Cancelled,
    cancellation: { reason: typed(reason), by: mockNameOf(officer), at: now },
  };
  saveMockEvent(updated);
  return toBusEvent(updated, Side.Office, language, now);
});

// ---------------------------------------------------------------------------------------------
// Abu El Hol

registerMock(listCompanyRequestsEndpoint, ({ query }, { token, language }) => {
  requireMockOffice(token, COMPANY);
  return listFor(query, Side.Company, language, Date.now());
});

registerMock(getCompanyRequestEndpoint, ({ params }, { token, language }) => {
  requireMockOffice(token, COMPANY);
  const now = Date.now();
  const item = requireEvent(params.event_id, now);
  const taken = busesTakenOn(item.eventDate, item.eventId, now);
  return {
    event: toBusEvent(item, Side.Company, language, now),
    // Spares at the garage first: a line bus still has its own trips that day.
    available_buses: [...fleet()]
      .sort((a, b) => Number(a.line !== null) - Number(b.line !== null))
      .filter(({ bus }) => !taken.has(bus.busId))
      .map(({ bus, line }) => ({
        ...toEventBus(bus, language),
        line: line ? toLineSummary(line, language) : null,
      })),
  };
});

registerMock(replyToRequestEndpoint, ({ params, body }, { token, language }) => {
  const company = requireMockOffice(token, COMPANY);
  const now = Date.now();
  const item = requireEvent(params.event_id, now);
  if (item.status !== EventStatus.WaitingCompany || isPast(item, now)) {
    fail(HTTP.Conflict, EventErrorCode.NotWaiting, "This request was already answered.");
  }
  const note = body.note?.trim() ?? "";
  let busIds: string[] = [];
  if (body.decision === EventAction.Confirm) {
    busIds = body.bus_ids;
    if (
      busIds.length === 0 ||
      busIds.length > item.busesRequested ||
      new Set(busIds).size !== busIds.length
    ) {
      fail(HTTP.Unprocessable, EventErrorCode.BusesInvalid, "Pick the buses you send.");
    }
    const owned = new Set(fleet().map(({ bus }) => bus.busId));
    const taken = busesTakenOn(item.eventDate, item.eventId, now);
    if (busIds.some((busId) => !owned.has(busId) || taken.has(busId))) {
      fail(HTTP.Conflict, EventErrorCode.BusNotAvailable, "A bus is not free that day.");
    }
  } else if (note.length < EVENT_REASON_MIN_LENGTH) {
    fail(HTTP.Unprocessable, EventErrorCode.ReasonRequired, "Write why you can't.");
  }
  const updated: MockBusEvent = {
    ...item,
    status: body.decision === EventAction.Confirm ? EventStatus.Confirmed : EventStatus.Declined,
    reply: { busIds, note: note ? typed(note) : null, by: mockNameOf(company), at: now },
  };
  saveMockEvent(updated);
  return toBusEvent(updated, Side.Company, language, now);
});

registerMock(getFleetEndpoint, (_input, { token, language }) => {
  requireMockOffice(token, COMPANY);
  const now = Date.now();
  const today = todayOf(now);
  const covering = new Map<string, string>();
  for (const { lineId, replacement } of allReplacements()) {
    if (todayOf(replacement.at) === today) covering.set(replacement.busId, lineId);
  }
  const eventsToday = allMockEvents(now).filter(
    (item) => item.eventDate === today && item.status === EventStatus.Confirmed,
  );
  const items: FleetBus[] = fleet().map(({ bus, line }) => {
    const coveringLine = findMockLine(covering.get(bus.busId) ?? "");
    const event = eventsToday.find((item) => item.reply?.busIds.includes(bus.busId));
    return {
      ...toEventBus(bus, language),
      line: line ? toLineSummary(line, language) : null,
      today: line
        ? FleetBusState.OnLine
        : coveringLine
          ? FleetBusState.Replacement
          : FleetBusState.Spare,
      covering_line: coveringLine && !line ? toLineSummary(coveringLine, language) : null,
      event_today: event
        ? { event_id: event.eventId, title: localized(language, event.title.ar, event.title.en) }
        : null,
    };
  });
  return {
    items,
    counts: {
      total: items.length,
      on_line: items.filter((item) => item.today === FleetBusState.OnLine).length,
      spare: items.filter((item) => item.today !== FleetBusState.OnLine).length,
      seats: items.reduce((sum, item) => sum + item.seats, 0),
    },
  };
});
