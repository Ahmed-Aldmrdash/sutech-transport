import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMyCard } from "@/features/card/api";
import { CardErrorCode } from "@/features/card/schema";
import { login, requestOtp } from "@/features/auth/api";
import { resetAuthMock } from "@/features/auth/mock";
import { getLine, listLines } from "@/features/lines/api";
import { getPaymentInstructions, listMyPayments, submitReceipt } from "@/features/payments/api";
import { PaymentErrorCode, PaymentStatus } from "@/features/payments/schema";
import { getMyNextTrip } from "@/features/trips/api";
import { type ApiError, isApiError } from "@/lib/api/errors";
import { tokenStore } from "@/lib/api/token-store";
import { cancelSubscription, createSubscription, getMySubscription } from "./api";
import { MOCK_REJECTED_REFERENCE_SUFFIX, MOCK_REVIEW_MS, resetStudentMock } from "./mock-state";
import { SubscriptionErrorCode, SubscriptionStatus } from "./schema";

const FULL_LINE = "ln_02";
const OPEN_LINE = "ln_12";
const OPEN_STOP = "ln_12_s7";
const TERM_PRICE = 1_500_000;

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

function receiptFor(subscriptionId: string, reference = "NBE-12345678") {
  return {
    subscription_id: subscriptionId,
    method: "bank_deposit" as const,
    reference_number: reference,
    amount_piasters: TERM_PRICE,
    paid_on: "2026-11-01",
    payer_name: "Mohamed Aldmrdash",
    receipt: { file_name: "slip.jpg", content_type: "image/jpeg" as const, data_base64: "AAAA" },
  };
}

describe("student journey (mock server)", () => {
  beforeEach(async () => {
    resetAuthMock();
    resetStudentMock();
    await signIn("240102791");
  });
  afterEach(() => {
    vi.useRealTimers();
    tokenStore.set(null);
  });

  it("lists the university's 25 routes at 15,000 EGP, arriving 8:45 to 9:00", async () => {
    const lines = await listLines();
    expect(lines).toHaveLength(25);
    expect(new Set(lines.map((line) => line.price_piasters))).toEqual(new Set([TERM_PRICE]));
    expect(lines.every((line) => line.campus_arrival.from === "08:45")).toBe(true);
    expect(lines.every((line) => line.return_departure_time === null)).toBe(true);
    const detail = await getLine(OPEN_LINE);
    expect(detail.stops.every((stop) => stop.location === null)).toBe(true);
  });

  it("starts with no subscription, and the card is locked", async () => {
    expect((await getMySubscription()).subscription).toBeNull();
    expect((await errorOf(getMyCard())).code).toBe(CardErrorCode.NotSubscribed);
    expect((await getMyNextTrip()).trip).toBeNull();
  });

  it("books a seat for 24 hours and takes it from the free seats", async () => {
    const before = (await getLine(OPEN_LINE)).seats_available;
    const booked = await createSubscription(OPEN_LINE, OPEN_STOP);
    expect(booked.status).toBe(SubscriptionStatus.Reserved);
    expect(booked.stop.pickup_time).toBe("07:22");
    const holdMs = Date.parse(booked.hold_expires_at ?? "") - Date.parse(booked.reserved_at);
    expect(holdMs).toBe(24 * 3_600_000);
    expect((await getLine(OPEN_LINE)).seats_available).toBe(before - 1);
    expect((await errorOf(createSubscription(OPEN_LINE, OPEN_STOP))).code).toBe(
      SubscriptionErrorCode.AlreadySubscribed,
    );
  });

  it("refuses a full line and a stop from another line", async () => {
    expect((await errorOf(createSubscription(FULL_LINE, "ln_02_s1"))).code).toBe(
      SubscriptionErrorCode.SeatUnavailable,
    );
    expect((await errorOf(createSubscription(OPEN_LINE, "ln_02_s1"))).code).toBe(
      SubscriptionErrorCode.StopNotOnLine,
    );
  });

  it("frees the seat when an unpaid booking is cancelled or its hold runs out", async () => {
    const booked = await createSubscription(OPEN_LINE, OPEN_STOP);
    await cancelSubscription(booked.subscription_id);
    expect((await getMySubscription()).subscription?.status).toBe(SubscriptionStatus.Cancelled);

    await createSubscription(OPEN_LINE, OPEN_STOP);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 24 * 3_600_000 + 1000);
    // The mock session lasts 12h, so sign in again after the jump (bookings survive sign-out).
    await signIn("240102791");
    const expired = (await getMySubscription()).subscription;
    expect(expired?.status).toBe(SubscriptionStatus.Expired);
    expect((await errorOf(submitReceipt(receiptFor(expired?.subscription_id ?? "")))).code).toBe(
      PaymentErrorCode.HoldExpired,
    );
  });

  it("activates the subscription and opens the card once finance approves the receipt", async () => {
    const instructions = await getPaymentInstructions();
    expect(instructions.bank.iban).toBe("EG080003000130715542035020200");
    expect(instructions.cashier_room).toBe("A045");

    const booked = await createSubscription(OPEN_LINE, OPEN_STOP);
    const sent = await submitReceipt(receiptFor(booked.subscription_id));
    expect(sent.status).toBe(PaymentStatus.PendingReview);
    expect((await getMySubscription()).subscription?.status).toBe(SubscriptionStatus.PaymentReview);

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + MOCK_REVIEW_MS + 1000);
    expect((await getMySubscription()).subscription?.status).toBe(SubscriptionStatus.Active);
    expect((await listMyPayments())[0]?.status).toBe(PaymentStatus.Approved);
    const card = await getMyCard();
    expect(card.line.code).toBe("12");
    expect(Date.parse(card.qr.expires_at) - Date.now()).toBeLessThanOrEqual(30_000);
    expect((await getMyNextTrip()).trip?.stop.pickup_time).toBe("07:22");
  });

  it("puts a rejected receipt's booking back on hold, and refuses a reused receipt", async () => {
    const booked = await createSubscription(OPEN_LINE, OPEN_STOP);
    await submitReceipt(
      receiptFor(booked.subscription_id, `NBE-${MOCK_REJECTED_REFERENCE_SUFFIX}`),
    );
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + MOCK_REVIEW_MS + 1000);
    const back = (await getMySubscription()).subscription;
    expect(back?.status).toBe(SubscriptionStatus.Reserved);
    expect(back?.latest_payment?.status).toBe(PaymentStatus.Rejected);
    expect(back?.latest_payment?.rejection_reason).toBeTruthy();

    await submitReceipt(receiptFor(booked.subscription_id, "NBE-777"));
    vi.setSystemTime(Date.now() + 1000);
    expect((await errorOf(submitReceipt(receiptFor(booked.subscription_id, "nbe-777")))).code).toBe(
      PaymentErrorCode.NotAwaitingPayment,
    );
  });

  it("shows Omar's card at once: he is an active subscriber on line 7", async () => {
    resetAuthMock();
    await signIn("240102684");
    expect((await getMySubscription()).subscription?.status).toBe(SubscriptionStatus.Active);
    expect((await getMyCard()).stop.pickup_time).toBe("07:50");
  });

  it("keeps other roles out of student endpoints", async () => {
    resetAuthMock();
    await signIn("FIN-1001");
    expect((await errorOf(getMySubscription())).status).toBe(403);
  });
});
