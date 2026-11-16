import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { login, requestOtp } from "@/features/auth/api";
import { resetAuthMock } from "@/features/auth/mock";
import { getCrewToday, scanRider, startTrip } from "@/features/crew/api";
import { resetCrewMock } from "@/features/crew/mock-state";
import { CrewErrorCode, RiderState, ScanAction, ScanMethod } from "@/features/crew/schema";
import { createSubscription } from "@/features/subscriptions/api";
import { resetStudentMock } from "@/features/subscriptions/mock-state";
import { TripDirection } from "@/features/trips/schema";
import { type ApiError, isApiError } from "@/lib/api/errors";
import { tokenStore } from "@/lib/api/token-store";
import { createDiscipline, getMyStanding, getStudentStanding, liftDiscipline } from "./api";
import { resetDisciplineMock } from "./mock-state";
import { DisciplineAction, DisciplineErrorCode, Standing } from "./schema";

const TRANSPORT = "TRN-1001";
const AFFAIRS = "STA-1001";
const FINANCE = "FIN-1001";
const DRIVER = "DRV-1001";
const OMAR = "240100102"; // active on line 7
const OMAR_ID = "usr_student_2";
const ZIAD = "240100101"; // no booking
const ZIAD_ID = "usr_student_1";
/** Sunday 8 Nov 2026, 07:30 in Cairo: line 7 is about to leave. */
const SUNDAY_MORNING = Date.parse("2026-11-08T05:30:00Z");

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

async function boardOmar() {
  const today = await getCrewToday();
  const trip = today.trips.find((item) => item.direction === TripDirection.Outbound);
  if (!trip) throw new Error("no outbound trip");
  await startTrip(trip.trip_id);
  return scanRider(trip.trip_id, {
    action: ScanAction.Board,
    method: ScanMethod.Manual,
    qr_token: null,
    identifier: OMAR,
    reason: null,
    note: null,
  });
}

describe("warnings, suspensions and bans (mock server)", () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SUNDAY_MORNING);
    resetAuthMock();
    resetStudentMock();
    resetCrewMock();
    resetDisciplineMock();
    await signIn(TRANSPORT);
  });
  afterEach(() => {
    vi.useRealTimers();
    tokenStore.set(null);
  });

  it("warns a student, who sees it, and a warning can't be lifted", async () => {
    const warned = await createDiscipline(OMAR_ID, {
      action: DisciplineAction.Warning,
      reason: "Shouted at the driver",
      ends_on: null,
    });
    expect(warned.standing).toBe(Standing.Warned);
    const record = warned.records[0];
    if (!record) throw new Error("no record");
    expect(
      (await errorOf(liftDiscipline(record.record_id, { note: "Changed my mind" }))).code,
    ).toBe(DisciplineErrorCode.NotLiftable);

    await signIn(OMAR);
    const mine = await getMyStanding();
    expect(mine.standing).toBe(Standing.Warned);
    expect(mine.records[0]?.reason).toBe("Shouted at the driver");
  });

  it("suspends a student: the crew can't board them until it is lifted", async () => {
    const suspended = await createDiscipline(OMAR_ID, {
      action: DisciplineAction.Suspension,
      reason: "Damaged a seat",
      ends_on: "2026-11-12",
    });
    expect(suspended.standing).toBe(Standing.Suspended);
    expect(suspended.suspended_until).toBe("2026-11-12");

    await signIn(DRIVER);
    expect((await errorOf(boardOmar())).code).toBe(CrewErrorCode.StudentSuspended);
    const today = await getCrewToday();
    const outbound = today.trips.find((item) => item.direction === TripDirection.Outbound);
    expect(outbound?.counts.suspended).toBe(1);
    expect(outbound?.riders.find((rider) => rider.identifier === OMAR)?.state).toBe(
      RiderState.Suspended,
    );

    await signIn(TRANSPORT);
    const record = suspended.records[0];
    if (!record) throw new Error("no record");
    const lifted = await liftDiscipline(record.record_id, { note: "Paid for the repair" });
    expect(lifted.standing).toBe(Standing.Good);
    await signIn(DRIVER);
    const boarded = await scanRider(outbound?.trip_id ?? "", {
      action: ScanAction.Board,
      method: ScanMethod.Manual,
      qr_token: null,
      identifier: OMAR,
      reason: null,
      note: null,
    });
    expect(boarded.rider.state).toBe(RiderState.Boarded);
  });

  it("refuses a suspension with no end day or too far ahead", async () => {
    for (const endsOn of [null, "2026-11-08", "2027-06-01"]) {
      expect(
        (
          await errorOf(
            createDiscipline(OMAR_ID, {
              action: DisciplineAction.Suspension,
              reason: "Damaged a seat",
              ends_on: endsOn,
            }),
          )
        ).code,
      ).toBe(DisciplineErrorCode.InvalidSuspension);
    }
  });

  it("bans a student from booking; Student Affairs can do it too", async () => {
    await signIn(AFFAIRS);
    await createDiscipline(ZIAD_ID, {
      action: DisciplineAction.Ban,
      reason: "Repeated fights on the bus",
      ends_on: null,
    });
    expect(
      (
        await errorOf(
          createDiscipline(ZIAD_ID, {
            action: DisciplineAction.Ban,
            reason: "Again",
            ends_on: null,
          }),
        )
      ).code,
    ).toBe(DisciplineErrorCode.AlreadyBanned);

    await signIn(ZIAD);
    expect((await errorOf(createSubscription("ln_12", "ln_12_s7"))).code).toBe(
      DisciplineErrorCode.StudentBanned,
    );
  });

  it("keeps other offices out", async () => {
    await signIn(FINANCE);
    expect((await errorOf(getStudentStanding(OMAR_ID))).status).toBe(403);
  });
});
