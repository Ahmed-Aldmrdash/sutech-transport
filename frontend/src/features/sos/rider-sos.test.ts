import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listAnnouncements } from "@/features/announcements/api";
import { login, requestOtp } from "@/features/auth/api";
import { resetAuthMock } from "@/features/auth/mock";
import { getCrewToday, startTrip } from "@/features/crew/api";
import { resetCrewMock } from "@/features/crew/mock-state";
import { addSosAction } from "@/features/emergencies/api";
import { listNotifications } from "@/features/notifications/api";
import { resetStudentMock } from "@/features/subscriptions/mock-state";
import { TripDirection } from "@/features/trips/schema";
import { type ApiError, isApiError } from "@/lib/api/errors";
import { tokenStore } from "@/lib/api/token-store";
import { createSos, getMyRiderSos } from "./api";
import { resetSosMock } from "./mock-state";
import { SosErrorCode, SosType } from "./schema";

const DRIVER = "DRV-1001";
const SEIF = "240100102";
const SEIF_FATHER = "01000002001";
const TRANSPORT = "TRN-1001";
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

async function driverOutboundTrip() {
  await signIn(DRIVER);
  const today = await getCrewToday();
  const trip = today.trips.find((item) => item.direction === TripDirection.Outbound);
  if (!trip) throw new Error("no outbound trip");
  return trip.trip_id;
}

describe("a student raises an SOS (mock server)", () => {
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

  it("is refused before the trip starts", async () => {
    const tripId = await driverOutboundTrip();
    await signIn(SEIF);
    expect(await getMyRiderSos()).toEqual({ trip_id: null, sos: null });
    const error = await errorOf(createSos({ trip_id: tripId, type: SosType.Medical, note: null }));
    expect(error.code).toBe(SosErrorCode.NotOnATrip);
  });

  it("records who raised it on a running trip and tells the guardian nothing", async () => {
    const tripId = await driverOutboundTrip();
    await startTrip(tripId);
    await signIn(SEIF_FATHER);
    const notificationsBefore = await listNotifications();
    const announcementsBefore = await listAnnouncements();

    await signIn(SEIF);
    expect((await getMyRiderSos()).trip_id).toBe(tripId);
    const sos = await createSos({ trip_id: tripId, type: SosType.Medical, note: null });
    expect(sos.raised_by.role).toBe("student");
    expect((await getMyRiderSos()).sos?.id).toBe(sos.id);

    await signIn(TRANSPORT);
    await addSosAction(sos.id, { action: "acknowledge", note: null });
    await addSosAction(sos.id, { action: "close", note: "Handled." });

    await signIn(SEIF_FATHER);
    expect(await listNotifications()).toEqual(notificationsBefore);
    expect(await listAnnouncements()).toEqual(announcementsBefore);
  });

  it("shows the student an alert the driver already raised, without making a second", async () => {
    const tripId = await driverOutboundTrip();
    await startTrip(tripId);
    const first = await createSos({ trip_id: tripId, type: SosType.Breakdown, note: null });

    await signIn(SEIF);
    expect((await getMyRiderSos()).sos?.id).toBe(first.id);
    const again = await createSos({ trip_id: tripId, type: SosType.Medical, note: null });
    expect(again.id).toBe(first.id);
  });
});
