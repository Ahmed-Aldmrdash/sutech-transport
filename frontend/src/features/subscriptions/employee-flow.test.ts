import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { login, requestOtp } from "@/features/auth/api";
import { resetAuthMock } from "@/features/auth/mock";
import { getMyCard } from "@/features/card/api";
import { resetCrewMock } from "@/features/crew/mock-state";
import { createDiscipline, getStudentStanding } from "@/features/discipline/api";
import { DisciplineAction } from "@/features/discipline/schema";
import { getLine } from "@/features/lines/api";
import { listNotifications } from "@/features/notifications/api";
import { getOpsStudent, listOpsStudents } from "@/features/ops-desk/api";
import { listMyPayments } from "@/features/payments/api";
import { getDeskRequest } from "@/features/request-desk/api";
import { createComplaint, listMyRequests } from "@/features/requests/api";
import { resetRequestsMock } from "@/features/requests/mock-state";
import { ComplaintCategory } from "@/features/requests/schema";
import { getMyNextTrip } from "@/features/trips/api";
import { getMyTracking } from "@/features/tracking/api";
import { type ApiError, isApiError } from "@/lib/api/errors";
import { tokenStore } from "@/lib/api/token-store";
import { cancelSubscription, createSubscription, getMySubscription } from "./api";
import { resetStudentMock } from "./mock-state";
import { SubscriptionStatus } from "./schema";

const SUBSCRIBED_STAFF = "EMP-2001";
const DOCTOR = "EMP-2002";
const DOCTOR_ID = "usr_employee_2";
const TRANSPORT = "TRN-1001";
/** Sunday 15 Nov 2026, 07:30 in Cairo: a school morning. */
const SCHOOL_MORNING = Date.parse("2026-11-15T05:30:00Z");
const FORBIDDEN = 403;
const NOT_FOUND = 404;

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

async function bookLine(lineId: string) {
  const line = await getLine(lineId);
  return createSubscription(lineId, line.stops[0]?.stop_id ?? "");
}

function complaint(category: ComplaintCategory) {
  return createComplaint({
    category,
    line_id: null,
    happened_on: "2026-11-15",
    description: "The bus was late this morning.",
    attachments: [],
  });
}

describe("staff and faculty ride for free (mock server)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SCHOOL_MORNING);
    resetAuthMock();
    resetStudentMock();
    resetCrewMock();
    resetRequestsMock();
  });
  afterEach(() => {
    vi.useRealTimers();
    tokenStore.set(null);
  });

  it("books an active seat at no price, with a card at once", async () => {
    await signIn(DOCTOR);
    const before = (await getLine("ln_05")).seats_available;
    const booked = await bookLine("ln_05");
    expect(booked.status).toBe(SubscriptionStatus.Active);
    expect(booked.price_piasters).toBe(0);
    expect(booked.hold_expires_at).toBeNull();
    expect((await getLine("ln_05")).seats_available).toBe(before - 1);
    expect((await getMyCard()).student.identifier).toBe(DOCTOR);
  });

  it("changes line by cancelling and booking again", async () => {
    await signIn(DOCTOR);
    const first = await bookLine("ln_05");
    await cancelSubscription(first.subscription_id);
    expect((await getMySubscription()).subscription?.status).toBe(SubscriptionStatus.Cancelled);
    const second = await bookLine("ln_06");
    expect(second.line.line_id).toBe("ln_06");
    expect(second.status).toBe(SubscriptionStatus.Active);
  });

  it("has no payments or payment complaints", async () => {
    await signIn(SUBSCRIBED_STAFF);
    expect((await errorOf(listMyPayments())).status).toBe(FORBIDDEN);
    expect((await errorOf(complaint(ComplaintCategory.Payment))).status).toBe(FORBIDDEN);
  });

  it("follows the bus and complains about it", async () => {
    await signIn(SUBSCRIBED_STAFF);
    expect((await getMySubscription()).subscription?.line.line_id).toBe("ln_05");
    expect((await getMyNextTrip()).trip).not.toBeNull();
    await expect(getMyTracking()).resolves.toBeDefined();
    await expect(listNotifications()).resolves.toBeDefined();
    const sent = await complaint(ComplaintCategory.Delay);
    expect((await listMyRequests()).map((item) => item.request_id)).toContain(sent.request_id);

    await signIn(TRANSPORT);
    const onDesk = await getDeskRequest(sent.request_id);
    expect(onDesk.student.identifier).toBe(SUBSCRIBED_STAFF);
    expect(onDesk.student.level).toBeNull();
  });

  it("shows the office the staff apart from students, with no guardian or discipline", async () => {
    await signIn(DOCTOR);
    await bookLine("ln_05");

    await signIn(TRANSPORT);
    const staff = await listOpsStudents({ rider_type: "employee" });
    expect(staff.items.map((item) => item.identifier).sort()).toEqual([SUBSCRIBED_STAFF, DOCTOR]);
    const students = await listOpsStudents({ rider_type: "student" });
    expect(students.items.every((item) => item.rider_type === "student")).toBe(true);
    expect((await listOpsStudents({})).total).toBe(students.total + staff.total);
    expect((await listOpsStudents({ q: "emp-2002" })).items).toHaveLength(1);

    const doctor = await getOpsStudent(DOCTOR_ID);
    expect(doctor.rider_type).toBe("employee");
    expect(doctor.guardian).toBeNull();
    expect(doctor.level).toBeNull();
    expect((await errorOf(getStudentStanding(DOCTOR_ID))).status).toBe(NOT_FOUND);
    const warning = createDiscipline(DOCTOR_ID, {
      action: DisciplineAction.Warning,
      reason: "Stood in the bus aisle.",
      ends_on: null,
    });
    expect((await errorOf(warning)).status).toBe(NOT_FOUND);
  });
});
