import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listAnnouncements } from "@/features/announcements/api";
import { login, requestOtp } from "@/features/auth/api";
import { resetAuthMock } from "@/features/auth/mock";
import { getCrewToday, startTrip } from "@/features/crew/api";
import { resetCrewMock } from "@/features/crew/mock-state";
import { createSos, getSos } from "@/features/sos/api";
import { resetSosMock } from "@/features/sos/mock-state";
import { SosAction, SosStatus, SosType } from "@/features/sos/schema";
import { resetStudentMock } from "@/features/subscriptions/mock-state";
import { getMyTracking } from "@/features/tracking/api";
import { TripDirection } from "@/features/trips/schema";
import { type ApiError, isApiError } from "@/lib/api/errors";
import { tokenStore } from "@/lib/api/token-store";
import {
  addSosAction,
  getAdminSos,
  getReplacementOptions,
  listAdminSos,
  sendReplacement,
} from "./api";
import { EmergencyErrorCode, ReplacementReason } from "./schema";

const DRIVER = "DRV-1001";
const TRANSPORT = "TRN-1001";
const CLINIC = "CLN-1001";
const OMAR = "240100102";
/** Sunday 8 Nov 2026, 07:30 in Cairo: the line 7 bus is about to leave. */
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

/** The line 7 driver starts the outbound trip and raises an SOS. */
async function raise(type: SosType) {
  await signIn(DRIVER);
  const today = await getCrewToday();
  const trip = today.trips.find((item) => item.direction === TripDirection.Outbound);
  if (!trip) throw new Error("no outbound trip");
  if (trip.status === "not_started") await startTrip(trip.trip_id);
  const sos = await createSos({ trip_id: trip.trip_id, type, note: null });
  return { sos, tripId: trip.trip_id };
}

describe("the office takes an SOS (mock server)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SUNDAY_MORNING);
    resetAuthMock();
    resetStudentMock();
    resetCrewMock();
    resetSosMock();
  });
  afterEach(() => {
    vi.useRealTimers();
    tokenStore.set(null);
  });

  it("lists the alert with the bus, driver and crew phone, and logs each step", async () => {
    const { sos } = await raise(SosType.Breakdown);
    await signIn(TRANSPORT);
    const { items } = await listAdminSos();
    expect(items.map((item) => item.id)).toEqual([sos.id]);
    const alert = items[0];
    expect(alert?.line.line_id).toBe("ln_07");
    expect(alert?.bus.plate).toBe("ج ص 9943");
    expect(alert?.raised_by_phone).toBe("01000004008");

    expect((await errorOf(addSosAction(sos.id, { action: "note", note: "On it" }))).code).toBe(
      EmergencyErrorCode.NotAcknowledged,
    );
    await addSosAction(sos.id, { action: "acknowledge", note: null });
    expect((await errorOf(addSosAction(sos.id, { action: "acknowledge", note: null }))).code).toBe(
      EmergencyErrorCode.AlreadyAcknowledged,
    );
    await addSosAction(sos.id, { action: "note", note: "Called the driver." });
    const closed = await addSosAction(sos.id, { action: "close", note: "Tyre changed." });
    expect(closed.status).toBe(SosStatus.Closed);
    expect(closed.actions.map((entry) => entry.action)).toEqual([
      SosAction.Acknowledge,
      SosAction.Note,
      SosAction.Close,
    ]);
    expect(closed.actions[0]?.by_name).toBe("كريم فتحي");
    expect((await errorOf(addSosAction(sos.id, { action: "note", note: "x" }))).code).toBe(
      EmergencyErrorCode.SosClosed,
    );
    expect((await listAdminSos({ status: SosStatus.Open })).items).toEqual([]);

    await signIn(DRIVER);
    expect((await getSos(sos.id)).status).toBe(SosStatus.Closed);
  });

  it("shows the clinic medical alerts only", async () => {
    const breakdown = await raise(SosType.Breakdown);
    const medical = await raise(SosType.Medical);
    await signIn(CLINIC);
    const { items } = await listAdminSos();
    expect(items.map((item) => item.id)).toEqual([medical.sos.id]);
    expect((await errorOf(getAdminSos(breakdown.sos.id))).status).toBe(404);
    expect((await errorOf(getReplacementOptions(medical.tripId))).status).toBe(403);
  });

  it("sends a replacement bus that the crew, the student and the line notices follow", async () => {
    const { sos, tripId } = await raise(SosType.Breakdown);
    await signIn(TRANSPORT);
    await addSosAction(sos.id, { action: "acknowledge", note: null });
    const options = await getReplacementOptions(tripId);
    expect(options.bus.plate).toBe("ج ص 9943");
    expect(options.riders).toBeGreaterThan(0);
    const spare = options.buses[0];
    if (!spare) throw new Error("no spare bus");

    expect(
      (
        await errorOf(
          sendReplacement(tripId, {
            bus_id: null,
            driver_id: options.driver.driver_id,
            reason: ReplacementReason.Other,
            note: null,
            sos_id: null,
          }),
        )
      ).code,
    ).toBe(EmergencyErrorCode.DriverNotAvailable);

    vi.setSystemTime(SUNDAY_MORNING + 60_000);
    const sent = await sendReplacement(tripId, {
      bus_id: spare.bus_id,
      driver_id: null,
      reason: ReplacementReason.Breakdown,
      note: null,
      sos_id: sos.id,
    });
    expect(sent.bus.plate).toBe(spare.plate);
    expect(sent.driver.name).toBe(spare.driver.name);
    const alert = await getAdminSos(sos.id);
    // The record keeps the bus the alert was raised on; the new one is in its replacements.
    expect(alert.bus.plate).toBe("ج ص 9943");
    expect(alert.replacements.at(-1)?.bus.plate).toBe(spare.plate);
    expect(alert.actions.at(-1)?.action).toBe(SosAction.ReplacementSent);
    expect(alert.actions.at(-1)?.note).toContain(spare.plate);
    expect((await getReplacementOptions(tripId)).buses.map((bus) => bus.bus_id)).not.toContain(
      spare.bus_id,
    );

    await signIn(DRIVER);
    const today = await getCrewToday();
    expect(today.bus.plate).toBe(spare.plate);
    expect(today.trips[0]?.replacement?.driver_name).toBe(spare.driver.name);

    vi.setSystemTime(SUNDAY_MORNING + 20 * 60_000);
    await signIn(OMAR);
    expect((await getMyTracking()).trip?.bus.plate).toBe(spare.plate);
    const notices = await listAnnouncements({ kind: "service_change" });
    expect(notices.items.slice(0, 2).map((item) => item.title)).toEqual([
      "تغيير في باص خط 7 النهارده",
      "باص خط 7 واقف على الطريق",
    ]);
  });

  it("keeps students and other offices out", async () => {
    await signIn(OMAR);
    expect((await errorOf(listAdminSos())).status).toBe(403);
    await signIn("FIN-1001");
    expect((await errorOf(listAdminSos())).status).toBe(403);
  });

  it("lets the super admin see every alert but act on none", async () => {
    const { sos, tripId } = await raise(SosType.Medical);
    await signIn("ADM-1001");
    expect((await listAdminSos()).items.some((item) => item.id === sos.id)).toBe(true);
    expect((await getAdminSos(sos.id)).id).toBe(sos.id);
    const tried = await errorOf(
      addSosAction(sos.id, { action: SosAction.Acknowledge, note: null }),
    );
    expect(tried.status).toBe(403);
    expect((await errorOf(getReplacementOptions(tripId))).status).toBe(403);
    await signIn(CLINIC);
    const taken = await addSosAction(sos.id, { action: SosAction.Acknowledge, note: null });
    expect(taken.status).toBe(SosStatus.Acknowledged);
  });
});
