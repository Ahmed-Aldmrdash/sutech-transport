import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listAudit } from "@/features/admin-system/api";
import { resetAudit } from "@/features/admin-system/mock-log";
import { login, requestOtp } from "@/features/auth/api";
import { resetAuthMock } from "@/features/auth/mock";
import { getLine } from "@/features/lines/api";
import { resetReturnTimes } from "@/features/lines/mock-timetable";
import { ServerErrorCode, isApiError, type ApiError } from "@/lib/api/errors";
import { tokenStore } from "@/lib/api/token-store";
import { changeReturnTime, getTimetable } from "./api";
import { TimetableErrorCode } from "./schema";

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

beforeEach(() => {
  resetAuthMock();
  resetReturnTimes();
  resetAudit();
});
afterEach(() => tokenStore.set(null));

describe("return times (mock server)", () => {
  it("has every line at campus by 8:30 and leaving at 4:30 PM", async () => {
    await signIn("TRN-1001");
    const timetable = await getTimetable();
    expect(timetable.items).toHaveLength(25);
    expect(timetable.default_return_time).toBe("16:30");
    for (const row of timetable.items) {
      expect(row.campus_arrival).toEqual({ from: "08:30", to: "08:30" });
      expect(row.return_departure_time).toBe("16:30");
      expect(row.changed_by_name).toBeNull();
    }
  });

  it("changes one line, then every line, and logs both", async () => {
    await signIn("TRN-1001");
    const one = await changeReturnTime({ line_ids: ["ln_07"], return_departure_time: "15:00" });
    const line7 = one.items.find((row) => row.line.line_id === "ln_07");
    expect(line7?.return_departure_time).toBe("15:00");
    expect(line7?.changed_by_name).not.toBeNull();
    expect(one.items.filter((row) => row.return_departure_time === "16:30")).toHaveLength(24);

    await signIn("240100102");
    expect((await getLine("ln_07")).return_departure_time).toBe("15:00");

    await signIn("TRN-1001");
    const all = await changeReturnTime({ line_ids: [], return_departure_time: "17:00" });
    expect(all.items.every((row) => row.return_departure_time === "17:00")).toBe(true);

    await signIn("ADM-1001");
    const log = await listAudit({ area: "timetable" });
    expect(log.items.map((entry) => entry.target)).toEqual([
      "كل الخطوط · العودة 5:00 م",
      "خط 7 · العودة 3:00 م",
    ]);
  });

  it("refuses an unknown line and keeps other offices out", async () => {
    await signIn("TRN-1001");
    const missing = await errorOf(
      changeReturnTime({ line_ids: ["ln_99"], return_departure_time: "16:00" }),
    );
    expect(missing.code).toBe(TimetableErrorCode.LineNotFound);
    await signIn("FIN-1001");
    expect((await errorOf(getTimetable())).code).toBe(ServerErrorCode.Forbidden);
    await signIn("240100102");
    expect((await errorOf(getTimetable())).code).toBe(ServerErrorCode.Forbidden);
  });
});
