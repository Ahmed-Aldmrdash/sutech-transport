import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { login, requestOtp } from "@/features/auth/api";
import { resetAuthMock } from "@/features/auth/mock";
import { resetCrewMock } from "@/features/crew/mock-state";
import { RiderState } from "@/features/crew/schema";
import { resetEventsMock } from "@/features/event-buses/mock-state";
import { ServerErrorCode, isApiError, type ApiError } from "@/lib/api/errors";
import { addDays } from "@/lib/api/mock/cairo-clock";
import { tokenStore } from "@/lib/api/token-store";
import { todayInCairo } from "@/lib/format";
import {
  getLineAttendance,
  getLiveBuses,
  getOpsFleet,
  getOpsLine,
  getOpsOverview,
  getOpsStudent,
  listOpsLines,
  listOpsStudents,
} from "./api";
import { OpsErrorCode } from "./schema";

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

/** The latest Sunday-to-Thursday before today. */
function lastServiceDay(): string {
  for (let back = 1; ; back += 1) {
    const day = addDays(todayInCairo(), -back);
    if (new Date(`${day}T12:00:00Z`).getUTCDay() <= 4) return day;
  }
}

beforeEach(() => {
  resetAuthMock();
  resetCrewMock();
  resetEventsMock();
});
afterEach(() => tokenStore.set(null));

describe("Transportation office operations (mock server)", () => {
  it("is for the Transportation office and the super admin only", async () => {
    await signIn("SGO-1001");
    expect((await errorOf(listOpsLines())).code).toBe(ServerErrorCode.Forbidden);
    await signIn("FIN-1001");
    expect((await errorOf(getLiveBuses())).code).toBe(ServerErrorCode.Forbidden);
    await signIn("ADM-1001");
    expect((await listOpsLines()).items.length).toBeGreaterThan(20);
  });

  it("shows the day with the office's queues", async () => {
    await signIn("TRN-1001");
    const day = await getOpsOverview({ date: lastServiceDay() });
    expect(day.is_service_day).toBe(true);
    expect(day.queues.events_waiting).toBeGreaterThan(0);
    expect(day.queues.requests_new + day.queues.complaints_new).toBeGreaterThan(0);
  });

  it("puts every line's bus on the map", async () => {
    await signIn("TRN-1001");
    const live = await getLiveBuses();
    expect(live.items).toHaveLength((await listOpsLines()).items.length);
    for (const bus of live.items) {
      expect(bus.position === null).toBe(bus.status !== "on_the_road");
      expect(bus.rode).toBeLessThanOrEqual(bus.subscribers);
    }
  });

  it("lists a line's stops and students, which add up", async () => {
    await signIn("TRN-1001");
    const line = await getOpsLine("ln_07");
    expect(line.students).toHaveLength(line.subscribers);
    expect(line.stops_list.reduce((sum, stop) => sum + stop.subscribers, 0)).toBe(line.subscribers);
    expect(line.students.some((student) => student.identifier === "240100102")).toBe(true);
    expect(line.subscribers + line.seats_free + line.reserved).toBe(line.bus.seats);
    expect((await errorOf(getOpsLine("ln_nope"))).code).toBe(OpsErrorCode.LineNotFound);
  });

  it("takes attendance of a past day, where nobody is still waiting", async () => {
    await signIn("TRN-1001");
    const day = await getLineAttendance({ line_id: "ln_07", date: lastServiceDay() });
    expect(day.trip_status).toBe("ended");
    expect(day.counts.waiting).toBe(0);
    expect(day.riders.some((rider) => rider.state === RiderState.Boarded)).toBe(true);
    expect(
      (await errorOf(getLineAttendance({ line_id: "ln_07", date: addDays(todayInCairo(), 2) })))
        .code,
    ).toBe(OpsErrorCode.DateInvalid);
  });

  it("finds students and opens one with their guardian", async () => {
    await signIn("TRN-1001");
    const found = await listOpsStudents({ q: "240100102" });
    expect(found.total).toBe(1);
    const seif = await getOpsStudent(found.items[0]?.student_id ?? "");
    expect(seif.line?.line_id).toBe("ln_07");
    expect(seif.guardian?.has_account).toBe(true);
    const ziad = (await listOpsStudents({ q: "240100101" })).items[0];
    expect(ziad?.line).toBeNull();
    const onLine = await listOpsStudents({ line_id: "ln_07" });
    expect(onLine.total).toBe((await getOpsLine("ln_07")).subscribers);
  });

  it("lists the fleet with today's trips to change", async () => {
    await signIn("TRN-1001");
    const fleet = await getOpsFleet();
    expect(fleet.items.length).toBe(fleet.counts.total);
  });
});
