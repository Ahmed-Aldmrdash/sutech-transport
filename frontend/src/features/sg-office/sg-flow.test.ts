import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { login, requestOtp } from "@/features/auth/api";
import { resetAuthMock } from "@/features/auth/mock";
import { resetCrewMock } from "@/features/crew/mock-state";
import { resetEventsMock } from "@/features/event-buses/mock-state";
import { ServerErrorCode, isApiError, type ApiError } from "@/lib/api/errors";
import { addDays } from "@/lib/api/mock/cairo-clock";
import { tokenStore } from "@/lib/api/token-store";
import { todayInCairo } from "@/lib/format";
import { getSgOverview, getWatchlist, unwatchStudent, watchStudent } from "./api";
import { resetSgMock } from "./mock";
import { LineDayStatus, SgErrorCode, WatchedStatus } from "./schema";

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

/** The latest Sunday-to-Thursday before today: every timetable trip on it has ended. */
function lastServiceDay(): string {
  for (let back = 1; ; back += 1) {
    const day = addDays(todayInCairo(), -back);
    if (new Date(`${day}T12:00:00Z`).getUTCDay() <= 4) return day;
  }
}

function lastFriday(): string {
  for (let back = 1; ; back += 1) {
    const day = addDays(todayInCairo(), -back);
    if (new Date(`${day}T12:00:00Z`).getUTCDay() === 5) return day;
  }
}

beforeEach(() => {
  resetAuthMock();
  resetCrewMock();
  resetEventsMock();
  resetSgMock();
});
afterEach(() => tokenStore.set(null));

describe("Secretary General's page (mock server)", () => {
  it("is only for the Secretary General (and the super admin)", async () => {
    await signIn("TRN-1001");
    expect((await errorOf(getSgOverview())).code).toBe(ServerErrorCode.Forbidden);
    await signIn("ADM-1001");
    expect((await getSgOverview()).lines.length).toBeGreaterThan(20);
  });

  it("counts a past service day: every line ended, riders add up", async () => {
    await signIn("SGO-1001");
    const day = await getSgOverview({ date: lastServiceDay() });
    expect(day.is_service_day).toBe(true);
    expect(day.is_today).toBe(false);
    const timetabled = day.lines;
    expect(timetabled.every((line) => line.status === LineDayStatus.Ended)).toBe(true);
    for (const line of timetabled) {
      expect(line.rode + line.not_going + line.absent).toBe(line.subscribers);
    }
    expect(day.totals.rode).toBe(day.lines.reduce((sum, line) => sum + line.rode, 0));
  });

  it("waits for the demo crew on line 7 today", async () => {
    await signIn("SGO-1001");
    const today = await getSgOverview();
    const line7 = today.lines.find((line) => line.line.line_id === "ln_07");
    expect(line7?.status).toBe(
      today.is_service_day ? LineDayStatus.NotStarted : LineDayStatus.NoService,
    );
  });

  it("says when there is no service and refuses days out of range", async () => {
    await signIn("SGO-1001");
    const friday = await getSgOverview({ date: lastFriday() });
    expect(friday.is_service_day).toBe(false);
    expect(friday.totals.subscribers).toBe(0);
    expect((await errorOf(getSgOverview({ date: addDays(todayInCairo(), 1) }))).code).toBe(
      SgErrorCode.DateInvalid,
    );
    expect((await errorOf(getSgOverview({ date: addDays(todayInCairo(), -40) }))).code).toBe(
      SgErrorCode.DateInvalid,
    );
  });

  it("follows students by university ID", async () => {
    await signIn("SGO-1001");
    expect((await errorOf(watchStudent("999999999"))).code).toBe(SgErrorCode.StudentNotFound);
    const list = await watchStudent("240100102");
    expect(list.items[0]?.student.line?.line_id).toBe("ln_07");
    expect((await errorOf(watchStudent("240100102"))).code).toBe(SgErrorCode.AlreadyWatched);
    const ziad = await watchStudent("240100101");
    expect(ziad.items[0]?.student.identifier).toBe("240100101");
    const past = await getWatchlist({ date: lastServiceDay() });
    expect(past.items.find((item) => item.student.identifier === "240100101")?.status).toBe(
      WatchedStatus.NoSubscription,
    );
    const after = await unwatchStudent(ziad.items[0]?.student.student_id ?? "");
    expect(after.items).toHaveLength(1);
  });
});
