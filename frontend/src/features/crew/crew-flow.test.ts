import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { login, requestOtp } from "@/features/auth/api";
import { resetAuthMock } from "@/features/auth/mock";
import { getMyCard } from "@/features/card/api";
import { listAnnouncements } from "@/features/announcements/api";
import { getMyAttendance } from "@/features/attendance/api";
import { createSos, getSos } from "@/features/sos/api";
import { addSosAction } from "@/features/emergencies/api";
import { resetSosMock } from "@/features/sos/mock-state";
import { SosStatus, SosType } from "@/features/sos/schema";
import { resetStudentMock } from "@/features/subscriptions/mock-state";
import { getMyTracking } from "@/features/tracking/api";
import { TripDirection } from "@/features/trips/schema";
import { createViolation, listMyViolations } from "@/features/violations/api";
import { resetViolationsMock } from "@/features/violations/mock-state";
import { ConductRule } from "@/features/violations/schema";
import { type ApiError, isApiError } from "@/lib/api/errors";
import { tokenStore } from "@/lib/api/token-store";
import { endTrip, getCrewToday, reportDelay, scanRider, startTrip } from "./api";
import { resetCrewMock } from "./mock-state";
import {
  CheckoutReason,
  CrewErrorCode,
  CrewTripStatus,
  DelayReason,
  RiderState,
  ScanAction,
  ScanMethod,
  type CrewTrip,
} from "./schema";

const DRIVER = "DRV-1001";
const OMAR = "240100102"; // active on line 7, stop 2
const OMAR_ID = "usr_student_2";
const AHMED = "240100101"; // no booking
const COASTER_SEATS = 28;
/** Sunday 8 Nov 2026, 07:30 in Cairo (UTC+2): the line 7 bus is about to leave. */
const SUNDAY_MORNING = Date.parse("2026-11-08T05:30:00Z");
const SATURDAY = Date.parse("2026-11-07T10:00:00Z");
const MINUTE = 60_000;

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

async function outbound(): Promise<CrewTrip> {
  const today = await getCrewToday();
  const trip = today.trips.find((item) => item.direction === TripDirection.Outbound);
  if (!trip) throw new Error("no outbound trip");
  return trip;
}

function manual(identifier: string, action: ScanAction = ScanAction.Board) {
  return {
    action,
    method: ScanMethod.Manual,
    qr_token: null,
    identifier,
    reason: action === ScanAction.Checkout ? CheckoutReason.Unwell : null,
    note: null,
  };
}

describe("driver and supervisor (mock server)", () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SUNDAY_MORNING);
    resetAuthMock();
    resetStudentMock();
    resetCrewMock();
    resetSosMock();
    resetViolationsMock();
    await signIn(DRIVER);
  });
  afterEach(() => {
    vi.useRealTimers();
    tokenStore.set(null);
  });

  it("sees line 7's bus, its stops and a full list of riders", async () => {
    const today = await getCrewToday();
    expect(today.is_service_day).toBe(true);
    expect(today.crew_role).toBe("driver");
    expect(today.line.line_id).toBe("ln_07");
    expect(today.bus.plate).toBe("ج ص 9943");
    expect(today.trips.map((trip) => trip.direction)).toEqual(["outbound", "return"]);
    const trip = await outbound();
    expect(trip.status).toBe(CrewTripStatus.NotStarted);
    expect(trip.riders).toHaveLength(COASTER_SEATS);
    expect(trip.riders.find((rider) => rider.student_id === OMAR_ID)?.stop_order).toBe(2);
    expect(trip.counts.waiting + trip.counts.not_going).toBe(COASTER_SEATS);
  });

  it("has no trips on Saturday", async () => {
    vi.setSystemTime(SATURDAY);
    const today = await getCrewToday();
    expect(today.is_service_day).toBe(false);
    expect(today.trips).toEqual([]);
  });

  it("scans only after the start, and ends with the absent marked", async () => {
    const trip = await outbound();
    expect((await errorOf(scanRider(trip.trip_id, manual(OMAR)))).code).toBe(
      CrewErrorCode.TripNotStarted,
    );
    const started = await startTrip(trip.trip_id);
    expect(started.status).toBe(CrewTripStatus.InProgress);
    expect((await errorOf(startTrip(trip.trip_id))).code).toBe(CrewErrorCode.TripAlreadyStarted);

    const { rider } = await scanRider(trip.trip_id, manual(OMAR));
    expect(rider.state).toBe(RiderState.Boarded);
    expect(rider.scan_method).toBe(ScanMethod.Manual);
    expect((await errorOf(scanRider(trip.trip_id, manual(OMAR)))).code).toBe(
      CrewErrorCode.AlreadyBoarded,
    );
    expect((await errorOf(scanRider(trip.trip_id, manual(AHMED)))).code).toBe(
      CrewErrorCode.NotOnThisTrip,
    );
    expect((await errorOf(scanRider(trip.trip_id, manual("999999999")))).code).toBe(
      CrewErrorCode.StudentNotFound,
    );

    vi.setSystemTime(SUNDAY_MORNING + 80 * MINUTE);
    const ended = await endTrip(trip.trip_id);
    expect(ended.status).toBe(CrewTripStatus.Ended);
    expect(ended.counts.waiting).toBe(0);
    expect(ended.riders.find((item) => item.student_id === OMAR_ID)?.state).toBe(
      RiderState.Boarded,
    );
    expect(ended.counts.boarded + ended.counts.absent + ended.counts.not_going).toBe(COASTER_SEATS);
  });

  it("boards any rider on the list by university ID, not only the demo accounts", async () => {
    const trip = await outbound();
    await startTrip(trip.trip_id);
    const waiting = (await outbound()).riders.filter(
      (item) => item.state === RiderState.Waiting && item.student_id !== OMAR_ID,
    );
    expect(waiting.length).toBeGreaterThan(0);
    for (const item of waiting) {
      const { rider } = await scanRider(trip.trip_id, manual(item.identifier));
      expect(rider.state).toBe(RiderState.Boarded);
    }
  });

  it("checks a student out with a reason, and the guardian's day shows it", async () => {
    const trip = await outbound();
    await startTrip(trip.trip_id);
    expect((await errorOf(scanRider(trip.trip_id, manual(OMAR, ScanAction.Checkout)))).code).toBe(
      CrewErrorCode.NotOnBoard,
    );
    await scanRider(trip.trip_id, manual(OMAR));
    const { rider } = await scanRider(trip.trip_id, manual(OMAR, ScanAction.Checkout));
    expect(rider.state).toBe(RiderState.CheckedOut);
    expect(rider.checkout_reason).toBe(CheckoutReason.Unwell);

    await signIn(OMAR);
    const history = await getMyAttendance();
    expect(history.items.some((item) => item.service_date === "2026-11-08")).toBe(false);
  });

  it("boards from the pass's QR code and refuses an old screenshot", async () => {
    const trip = await outbound();
    await startTrip(trip.trip_id);
    await signIn(OMAR);
    const card = await getMyCard();
    await signIn(DRIVER);
    const qr = { ...manual(""), method: ScanMethod.Qr, identifier: null, qr_token: card.qr.token };
    vi.setSystemTime(SUNDAY_MORNING + 2 * MINUTE);
    expect((await errorOf(scanRider(trip.trip_id, qr))).code).toBe(CrewErrorCode.CardExpired);
    vi.setSystemTime(SUNDAY_MORNING + 10_000);
    const { rider } = await scanRider(trip.trip_id, qr);
    expect(rider.student_id).toBe(OMAR_ID);
    expect(rider.scan_method).toBe(ScanMethod.Qr);
    expect((await errorOf(scanRider(trip.trip_id, { ...qr, qr_token: "hello" }))).code).toBe(
      CrewErrorCode.CardInvalid,
    );
  });

  it('the student\'s map and "My trips" follow the trip the driver runs', async () => {
    const trip = await outbound();
    await startTrip(trip.trip_id);
    await scanRider(trip.trip_id, manual(OMAR));
    vi.setSystemTime(SUNDAY_MORNING + 20 * MINUTE);
    await signIn(OMAR);
    const live = await getMyTracking();
    expect(live.trip?.position).not.toBeNull();

    await signIn(DRIVER);
    vi.setSystemTime(SUNDAY_MORNING + 80 * MINUTE);
    await endTrip(trip.trip_id);
    await signIn(OMAR);
    const today = (await getMyAttendance()).items[0];
    expect(today?.service_date).toBe("2026-11-08");
    expect(today?.outcome).toBe("rode");
  });

  it("reports a delay that reaches the line's announcements", async () => {
    const trip = await outbound();
    const delay = await reportDelay(trip.trip_id, {
      minutes: 20,
      reason: DelayReason.Traffic,
      note: null,
    });
    expect(delay.minutes).toBe(20);
    expect((await outbound()).delays).toHaveLength(1);
    await signIn(OMAR);
    const { items } = await listAnnouncements({ kind: "delay" });
    expect(items[0]?.title).toContain("20");
    expect(items[0]?.line?.line_id).toBe("ln_07");
  });

  it("refuses a delay hours after a trip that never started", async () => {
    const trip = await outbound();
    vi.setSystemTime(SUNDAY_MORNING + 5 * 60 * MINUTE);
    const refused = await errorOf(
      reportDelay(trip.trip_id, { minutes: 10, reason: DelayReason.Traffic, note: null }),
    );
    expect(refused.code).toBe(CrewErrorCode.DelayOutOfWindow);
  });

  it("raises an SOS once per press, with the bus GPS position, and the office takes it", async () => {
    const trip = await outbound();
    await startTrip(trip.trip_id);
    const body = { trip_id: trip.trip_id, type: SosType.Breakdown, note: "Flat tyre" };
    const sos = await createSos(body, { idempotencyKey: "press-1" });
    expect(sos.status).toBe(SosStatus.Open);
    expect(sos.location?.source).toBe("bus_gps");
    expect(sos.raised_by.role).toBe("driver");
    const again = await createSos(body, { idempotencyKey: "press-1" });
    expect(again.id).toBe(sos.id);
    expect((await outbound()).sos?.id).toBe(sos.id);

    expect((await getSos(sos.id)).status).toBe(SosStatus.Open);
    await signIn("TRN-1001");
    await addSosAction(sos.id, { action: "acknowledge", note: null });
    await signIn(DRIVER);
    const followed = await getSos(sos.id);
    expect(followed.status).toBe(SosStatus.Acknowledged);
    expect(followed.actions[0]?.by_name).toBe("كريم فتحي");
  });

  it("records a violation with a photo", async () => {
    const trip = await outbound();
    await createViolation({
      trip_id: trip.trip_id,
      student_identifier: OMAR,
      rule: ConductRule.Smoking,
      description: "Smoking at the back of the bus.",
      photo: { file_name: "photo.jpg", content_type: "image/jpeg", data_base64: "AAAA" },
    });
    const { items } = await listMyViolations();
    // Newest first, after the one line 7's driver recorded before the demo.
    expect(items).toHaveLength(2);
    expect(items[0]?.student?.student_id).toBe(OMAR_ID);
    // It waits for Student Affairs to open it.
    expect(items[0]?.status).toBe("submitted");
  });

  it("keeps other roles out", async () => {
    await signIn(OMAR);
    expect((await errorOf(getCrewToday())).status).toBe(403);
  });
});
