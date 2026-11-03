import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { login, requestOtp } from "@/features/auth/api";
import { resetAuthMock } from "@/features/auth/mock";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/features/notifications/api";
import { resetNotificationsMock } from "@/features/notifications/mock";
import { NotificationKind, NotificationTarget } from "@/features/notifications/schema";
import { getMySubscription } from "@/features/subscriptions/api";
import { resetStudentMock } from "@/features/subscriptions/mock-state";
import { SubscriptionStatus } from "@/features/subscriptions/schema";
import { type ApiError, isApiError } from "@/lib/api/errors";
import { tokenStore } from "@/lib/api/token-store";
import {
  createComplaint,
  createLineChange,
  createModelPermit,
  createRefund,
  getRefundPolicy,
  getRequest,
  listMyRequests,
  withdrawRequest,
} from "./api";
import { MOCK_REQUEST_TIMING, resetRequestsMock } from "./mock-state";
import {
  RequestErrorCode,
  RequestKind,
  RequestStatus,
  RequestActor,
  type CreateLineChangeBody,
  type CreateModelPermitBody,
  type CreateRefundBody,
} from "./schema";

const MARIAM = "240102684"; // Omar, active on line 7 since September
const AHMED = "240102791"; // no booking
const NOV_2 = Date.parse("2026-11-02T08:00:00Z");
const OCT_1 = Date.parse("2026-10-01T08:00:00Z");
const DOCUMENT = {
  file_name: "report.pdf",
  content_type: "application/pdf" as const,
  data_base64: "AAAA",
};

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
  const session = await login(identifier, challenge.demo_code ?? "");
  tokenStore.set(session.token);
}

function at(time: number) {
  vi.setSystemTime(time);
}

function lineChange(overrides: Partial<CreateLineChangeBody> = {}): CreateLineChangeBody {
  return {
    to_line_id: "ln_12",
    to_stop_id: "ln_12_s3",
    duration: "permanent",
    starts_on: "2026-11-02",
    ends_on: null,
    reason: "We moved to a new flat near this line.",
    student_phone: "01012340684",
    guardian_name: "Ahmed Ramadan Ramadan",
    guardian_phone: "01098760684",
    guardian_consent: true,
    ...overrides,
  };
}

function modelPermit(overrides: Partial<CreateModelPermitBody> = {}): CreateModelPermitBody {
  return {
    material: "Wood and acrylic",
    dimensions: "60 × 40 × 30 cm",
    purpose: "display",
    purpose_other: null,
    destination: "Project exhibition, building B",
    entry_date: "2026-11-05",
    entry_time: "07:30",
    exit_date: "2026-11-05",
    exit_time: "16:00",
    supervisor_name: "Dr. Nihal",
    declaration_accepted: true,
    ...overrides,
  };
}

function refund(
  subscriptionId: string,
  overrides: Partial<CreateRefundBody> = {},
): CreateRefundBody {
  return {
    subscription_id: subscriptionId,
    reason: "standard",
    explanation: "I will come to campus by car from now on.",
    guardian_name: "Ahmed Ramadan Ramadan",
    guardian_phone: "01098760684",
    guardian_consent: true,
    documents: [],
    ...overrides,
  };
}

describe("student requests (mock server)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    at(NOV_2);
    resetAuthMock();
    resetStudentMock();
    resetRequestsMock();
    resetNotificationsMock();
  });
  afterEach(() => {
    vi.useRealTimers();
    tokenStore.set(null);
  });

  it("a line change moves through review to approval and moves the booking", async () => {
    await signIn(MARIAM);
    const sent = await createLineChange(lineChange());
    expect(sent.status).toBe(RequestStatus.Submitted);
    expect(sent.reference).toMatch(/^REQ-2026-\d{4}$/);
    expect((await errorOf(createLineChange(lineChange()))).code).toBe(
      RequestErrorCode.RequestAlreadyOpen,
    );

    at(NOV_2 + MOCK_REQUEST_TIMING.inReviewAfterMs + 1);
    const reviewing = await getRequest(sent.request_id);
    expect(reviewing.status).toBe(RequestStatus.InReview);
    expect(reviewing.timeline.at(-1)?.note).toContain("01098760684");

    at(NOV_2 + MOCK_REQUEST_TIMING.decidedAfterMs + 1);
    const decided = await getRequest(sent.request_id);
    expect(decided.status).toBe(RequestStatus.Approved);
    expect(decided.timeline.map((event) => event.status)).toEqual([
      RequestStatus.Submitted,
      RequestStatus.InReview,
      RequestStatus.Approved,
    ]);
    const { subscription } = await getMySubscription();
    expect(subscription?.line.line_id).toBe("ln_12");
    expect(subscription?.stop.stop_id).toBe("ln_12_s3");
  });

  it("a change to a full line is not approved", async () => {
    await signIn(MARIAM);
    const sent = await createLineChange(
      lineChange({ to_line_id: "ln_02", to_stop_id: "ln_02_s1" }),
    );
    at(NOV_2 + MOCK_REQUEST_TIMING.decidedAfterMs + 1);
    const decided = await getRequest(sent.request_id);
    expect(decided.status).toBe(RequestStatus.Rejected);
    expect((await getMySubscription()).subscription?.line.line_id).toBe("ln_07");
  });

  it("checks the line change like the university form", async () => {
    await signIn(MARIAM);
    expect(
      (await errorOf(createLineChange(lineChange({ to_line_id: "ln_07", to_stop_id: "ln_07_s1" }))))
        .code,
    ).toBe(RequestErrorCode.SameLine);
    expect((await errorOf(createLineChange(lineChange({ starts_on: "2026-10-01" })))).code).toBe(
      RequestErrorCode.InvalidDates,
    );
    const temporaryWithoutEnd = await errorOf(
      createLineChange(lineChange({ duration: "temporary", ends_on: null })),
    );
    expect(temporaryWithoutEnd.code).toBe("invalid_request");

    tokenStore.set(null);
    await signIn(AHMED);
    expect((await errorOf(createLineChange(lineChange()))).code).toBe(
      RequestErrorCode.NoActiveSubscription,
    );
  });

  it("after November 1 only exceptional refunds, with documents, are accepted", async () => {
    await signIn(MARIAM);
    const policy = await getRefundPolicy();
    expect(policy.today_deduction_percent).toBe(100);
    expect(policy.paid_piasters).toBe(1_500_000);
    expect(policy.windows).toHaveLength(3);
    const subscriptionId = policy.subscription_id ?? "";

    expect((await errorOf(createRefund(refund(subscriptionId)))).code).toBe(
      RequestErrorCode.RefundWindowClosed,
    );
    expect((await errorOf(createRefund(refund(subscriptionId, { reason: "medical" })))).code).toBe(
      RequestErrorCode.DocumentsRequired,
    );
    const sent = await createRefund(
      refund(subscriptionId, { reason: "medical", documents: [DOCUMENT] }),
    );
    expect(sent.kind).toBe(RequestKind.Refund);
    if (sent.kind !== RequestKind.Refund) return;
    expect(sent.details.estimated_refund_piasters).toBeNull();
    expect(sent.details.attachments[0]?.file_name).toBe("report.pdf");

    // The university decides exceptional cases: it stays under review.
    at(NOV_2 + 10 * MOCK_REQUEST_TIMING.decidedAfterMs);
    expect((await getRequest(sent.request_id)).status).toBe(RequestStatus.InReview);
    expect((await getMySubscription()).subscription?.status).toBe(SubscriptionStatus.Active);
  });

  it("in the 25% window an ordinary refund is approved and ends the subscription", async () => {
    at(OCT_1);
    await signIn(MARIAM);
    const policy = await getRefundPolicy();
    expect(policy.today_deduction_percent).toBe(25);
    const sent = await createRefund(refund(policy.subscription_id ?? ""));
    if (sent.kind !== RequestKind.Refund) throw new Error("expected a refund");
    expect(sent.details.estimated_refund_piasters).toBe(1_125_000);

    at(OCT_1 + MOCK_REQUEST_TIMING.decidedAfterMs + 1);
    expect((await getRequest(sent.request_id)).status).toBe(RequestStatus.Approved);
    expect((await getMySubscription()).subscription?.status).toBe(SubscriptionStatus.Cancelled);
  });

  it("a complaint is answered, and a new one can be withdrawn until the office opens it", async () => {
    await signIn(AHMED);
    const early = {
      category: "delay" as const,
      line_id: null,
      happened_on: "2026-11-01",
      description: "Asking before booking.",
    };
    expect((await errorOf(createComplaint({ ...early, attachments: [] }))).code).toBe(
      RequestErrorCode.NoActiveSubscription,
    );
    expect(
      (await errorOf(createComplaint({ ...early, category: "payment", attachments: [] }))).code,
    ).toBe(RequestErrorCode.NoSubscription);
    tokenStore.set(null);
    await signIn(MARIAM);
    const complaint = {
      category: "driver_behaviour" as const,
      line_id: "ln_07",
      happened_on: "2026-11-01",
      description: "The driver was speeding on the ring road.",
      attachments: [],
    };
    expect((await errorOf(createComplaint({ ...complaint, happened_on: "2026-11-03" }))).code).toBe(
      RequestErrorCode.InvalidDates,
    );
    const first = await createComplaint(complaint);
    const second = await createComplaint(complaint);
    expect((await withdrawRequest(second.request_id)).status).toBe(RequestStatus.Withdrawn);

    at(NOV_2 + MOCK_REQUEST_TIMING.decidedAfterMs + 1);
    const answered = await getRequest(first.request_id);
    expect(answered.status).toBe(RequestStatus.Resolved);
    expect(answered.timeline.at(-1)?.note).toBeTruthy();
    expect((await errorOf(withdrawRequest(first.request_id))).code).toBe(
      RequestErrorCode.NotWithdrawable,
    );
    const complaints = await listMyRequests(RequestKind.Complaint);
    expect(complaints.slice(0, 2).map((item) => item.request_id)).toEqual([
      second.request_id,
      first.request_id,
    ]);
  });
});

describe("model permit (mock server)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    at(NOV_2);
    resetAuthMock();
    resetStudentMock();
    resetRequestsMock();
    resetNotificationsMock();
  });
  afterEach(() => {
    vi.useRealTimers();
    tokenStore.set(null);
  });

  it("fills the student and bus from the account, and Safety approves it", async () => {
    await signIn(MARIAM);
    const sent = await createModelPermit(modelPermit());
    expect(sent.kind).toBe(RequestKind.ModelPermit);
    if (sent.kind !== RequestKind.ModelPermit) return;
    expect(sent.details.university_id).toBe(MARIAM);
    expect(sent.details.student_name).toBe("عمر أحمد رمضان رمضان");
    expect(sent.details.line.line_id).toBe("ln_07");
    expect(sent.details.driver_name).toBeNull();
    expect((await errorOf(createModelPermit(modelPermit()))).code).toBe(
      RequestErrorCode.RequestAlreadyOpen,
    );

    at(NOV_2 + MOCK_REQUEST_TIMING.inReviewAfterMs + 1);
    expect((await getRequest(sent.request_id)).timeline.at(-1)?.note).toContain("Dr. Nihal");

    at(NOV_2 + MOCK_REQUEST_TIMING.decidedAfterMs + 1);
    const decided = await getRequest(sent.request_id);
    expect(decided.status).toBe(RequestStatus.Approved);
    expect(decided.timeline.at(-1)?.by).toBe(RequestActor.Safety);
    expect((await listMyRequests(RequestKind.ModelPermit)).map((item) => item.request_id)).toEqual([
      sent.request_id,
    ]);
  });

  it("checks the permit like the university form", async () => {
    await signIn(MARIAM);
    expect(
      (
        await errorOf(
          createModelPermit(modelPermit({ entry_date: "2026-11-01", exit_date: "2026-11-01" })),
        )
      ).code,
    ).toBe(RequestErrorCode.InvalidDates);
    expect((await errorOf(createModelPermit(modelPermit({ exit_time: "07:00" })))).code).toBe(
      "invalid_request",
    );
    expect((await errorOf(createModelPermit(modelPermit({ purpose: "other" })))).code).toBe(
      "invalid_request",
    );

    tokenStore.set(null);
    await signIn(AHMED);
    expect((await errorOf(createModelPermit(modelPermit()))).code).toBe(
      RequestErrorCode.NoActiveSubscription,
    );
  });
});

describe("notifications (mock server)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    at(NOV_2);
    resetAuthMock();
    resetStudentMock();
    resetRequestsMock();
    resetNotificationsMock();
  });
  afterEach(() => {
    vi.useRealTimers();
    tokenStore.set(null);
  });

  it("collects request answers, payments and announcements, and tracks what's read", async () => {
    await signIn(MARIAM);
    const before = await listNotifications();
    expect(before.unread_count).toBeGreaterThan(0);
    expect(before.items.some((item) => item.kind === NotificationKind.PaymentApproved)).toBe(true);
    expect(before.items.some((item) => item.kind === NotificationKind.BusDelayed)).toBe(true);
    // Oldest first never: the list is newest first.
    const times = before.items.map((item) => item.created_at);
    expect([...times].sort().reverse()).toEqual(times);

    const complaint = await createComplaint({
      category: "delay",
      line_id: "ln_07",
      happened_on: "2026-11-02",
      description: "The bus was 30 minutes late this morning.",
      attachments: [],
    });
    at(NOV_2 + MOCK_REQUEST_TIMING.decidedAfterMs + 1);
    const after = await listNotifications({ unread_only: true });
    const answer = after.items.find((item) => item.link?.target === NotificationTarget.Complaint);
    expect(answer?.link?.id).toBe(complaint.request_id);
    expect(answer?.read_at).toBeNull();

    const marked = await markNotificationRead(answer?.notification_id ?? "");
    expect(marked.unread_count).toBe(after.unread_count - 1);
    expect((await markAllNotificationsRead()).unread_count).toBe(0);
    expect((await listNotifications()).unread_count).toBe(0);
  });
});
