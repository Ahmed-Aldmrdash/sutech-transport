import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { login, requestOtp } from "@/features/auth/api";
import { resetAuthMock } from "@/features/auth/mock";
import { BusType } from "@/features/lines/schema";
import { ClientErrorCode, ServerErrorCode, isApiError, type ApiError } from "@/lib/api/errors";
import { addDays } from "@/lib/api/mock/cairo-clock";
import { tokenStore } from "@/lib/api/token-store";
import { todayInCairo } from "@/lib/format";
import {
  cancelEvent,
  createEvent,
  getCompanyRequest,
  getEvent,
  getFleet,
  listCompanyRequests,
  listEvents,
  replyToRequest,
} from "./api";
import { resetEventsMock } from "./mock-state";
import {
  EventAction,
  EventErrorCode,
  EventKind,
  EventStatus,
  FleetBusState,
  type CreateEventBody,
} from "./schema";

async function errorOf(promise: Promise<unknown>): Promise<ApiError> {
  const caught: unknown = await promise.then(
    () => null,
    (error: unknown) => error,
  );
  if (!isApiError(caught)) throw new Error("expected an ApiError");
  return caught;
}

async function signIn(identifier: string) {
  const challenge = await requestOtp(identifier);
  await login(identifier, challenge.demo_code ?? "");
}

function newEvent(overrides: Partial<CreateEventBody> = {}): CreateEventBody {
  return {
    kind: EventKind.FieldTrip,
    title: "Smart grid lab visit",
    event_date: addDays(todayInCairo(), 4),
    departs_at: "09:00",
    returns_at: "15:00",
    pickup: "University main gate",
    destination: "New Capital",
    students_count: 60,
    bus_type: BusType.LargeBus,
    buses_requested: 2,
    note: null,
    ...overrides,
  };
}

beforeEach(() => {
  resetAuthMock();
  resetEventsMock();
});
afterEach(() => tokenStore.set(null));

describe("event buses (mock server)", () => {
  it("lists waiting requests first, only for the office and the company", async () => {
    await signIn("TRN-1001");
    const list = await listEvents();
    expect(list.items[0]?.status).toBe(EventStatus.WaitingCompany);
    expect(list.items.at(-1)?.is_past).toBe(true);
    expect(list.counts.waiting_company).toBe(1);
    expect(list.items[0]?.allowed_actions).toEqual([EventAction.Cancel]);

    await signIn("SGO-1001");
    expect((await errorOf(listEvents())).code).toBe(ServerErrorCode.Forbidden);
    await signIn("BUS-1001");
    expect((await errorOf(listEvents())).code).toBe(ServerErrorCode.Forbidden);
    const company = await listCompanyRequests();
    expect(company.items[0]?.allowed_actions).toEqual([EventAction.Confirm, EventAction.Decline]);
  });

  it("checks the day, the times and the seats", async () => {
    await signIn("TRN-1001");
    const today = todayInCairo();
    expect((await errorOf(createEvent(newEvent({ event_date: today })))).code).toBe(
      EventErrorCode.DateInvalid,
    );
    expect((await errorOf(createEvent(newEvent({ returns_at: "08:00" })))).code).toBe(
      EventErrorCode.TimesInvalid,
    );
    expect((await errorOf(createEvent(newEvent({ students_count: 101 })))).code).toBe(
      EventErrorCode.NotEnoughSeats,
    );
    const created = await createEvent(newEvent());
    expect(created.status).toBe(EventStatus.WaitingCompany);
    expect(created.seats_requested).toBe(100);
    expect((await errorOf(createEvent(newEvent()))).code).toBe(EventErrorCode.Duplicate);
  });

  it("lets Abu El Hol confirm with free buses, then the office sees them", async () => {
    await signIn("TRN-1001");
    const created = await createEvent(newEvent());

    await signIn("BUS-1001");
    const request = await getCompanyRequest(created.event_id);
    const [first, second] = request.available_buses;
    if (!first || !second) throw new Error("expected free buses");
    expect(
      (
        await errorOf(
          replyToRequest(created.event_id, { decision: "confirm", bus_ids: [], note: null }),
        )
      ).code,
    ).toBe(EventErrorCode.BusesInvalid);
    expect(
      (
        await errorOf(
          replyToRequest(created.event_id, { decision: "confirm", bus_ids: ["bus_x"], note: null }),
        )
      ).code,
    ).toBe(EventErrorCode.BusNotAvailable);
    const confirmed = await replyToRequest(created.event_id, {
      decision: "confirm",
      bus_ids: [first.bus_id],
      note: "One bus only that morning.",
    });
    expect(confirmed.status).toBe(EventStatus.Confirmed);
    expect(confirmed.company_reply?.buses).toHaveLength(1);
    expect(
      (
        await errorOf(
          replyToRequest(created.event_id, { decision: "decline", bus_ids: [], note: "Too late." }),
        )
      ).code,
    ).toBe(EventErrorCode.NotWaiting);

    await signIn("TRN-1001");
    const seen = await getEvent(created.event_id);
    expect(seen.company_reply?.buses[0]?.driver_phone).toMatch(/^010/);
    expect(seen.allowed_actions).toEqual([EventAction.Cancel]);
  });

  it("does not offer a bus already sent to another event that day", async () => {
    await signIn("TRN-1001");
    const one = await createEvent(newEvent());
    const two = await createEvent(newEvent({ title: "Second trip" }));
    await signIn("BUS-1001");
    const free = (await getCompanyRequest(one.event_id)).available_buses;
    const busId = free[0]?.bus_id ?? "";
    await replyToRequest(one.event_id, { decision: "confirm", bus_ids: [busId], note: null });
    const left = (await getCompanyRequest(two.event_id)).available_buses;
    expect(left.some((bus) => bus.bus_id === busId)).toBe(false);
  });

  it("needs a reason to decline or cancel", async () => {
    await signIn("TRN-1001");
    const created = await createEvent(newEvent());
    expect((await errorOf(cancelEvent(created.event_id, { reason: "no" }))).code).toBe(
      ClientErrorCode.InvalidRequest,
    );
    const cancelled = await cancelEvent(created.event_id, { reason: "The visit moved." });
    expect(cancelled.status).toBe(EventStatus.Cancelled);
    expect(cancelled.allowed_actions).toEqual([]);
    expect((await errorOf(cancelEvent(created.event_id, { reason: "Again please" }))).code).toBe(
      EventErrorCode.Closed,
    );
  });

  it("shows the company its fleet with the spares", async () => {
    await signIn("BUS-1001");
    const fleet = await getFleet();
    expect(fleet.counts.total).toBe(fleet.items.length);
    expect(fleet.items.some((bus) => bus.today === FleetBusState.Spare)).toBe(true);
    expect(fleet.items.filter((bus) => bus.today === FleetBusState.OnLine).length).toBe(
      fleet.counts.on_line,
    );
    await signIn("TRN-1001");
    expect((await errorOf(getFleet())).code).toBe(ServerErrorCode.Forbidden);
  });
});

describe("dates", () => {
  it("keeps a past seed out of every action", async () => {
    await signIn("TRN-1001");
    const past = (await listEvents()).items.find((item) => item.is_past);
    expect(past?.event_date).toBe(addDays(todayInCairo(), -6));
    expect(past?.allowed_actions).toEqual([]);
  });
});
