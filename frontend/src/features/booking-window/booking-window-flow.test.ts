import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { login, requestOtp } from "@/features/auth/api";
import { resetAuthMock } from "@/features/auth/mock";
import { createSubscription } from "@/features/subscriptions/api";
import { resetStudentMock } from "@/features/subscriptions/mock-state";
import { SubscriptionStatus } from "@/features/subscriptions/schema";
import { type ApiError, isApiError } from "@/lib/api/errors";
import { tokenStore } from "@/lib/api/token-store";
import { getBookingWindow, updateBookingWindow } from "./api";
import { resetBookingWindowMock } from "./mock-state";
import { BookingWindowAction, BookingWindowErrorCode, BookingWindowStatus } from "./schema";

const TRANSPORT = "TRN-1001";
const FINANCE = "FIN-1001";
const ZIAD = "240100101"; // no booking
const OPEN_LINE = "ln_12";
const OPEN_STOP = "ln_12_s7";
const NOW = Date.parse("2026-11-08T08:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

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

const iso = (time: number) => new Date(time).toISOString();

describe("booking window (mock server)", () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    resetAuthMock();
    resetStudentMock();
    resetBookingWindowMock();
    await signIn(TRANSPORT);
  });
  afterEach(() => {
    vi.useRealTimers();
    tokenStore.set(null);
  });

  it("starts open, and closing it stops new bookings even with free seats", async () => {
    expect((await getBookingWindow()).status).toBe(BookingWindowStatus.Open);
    const closed = await updateBookingWindow({
      action: BookingWindowAction.Close,
      opens_at: null,
      closes_at: null,
      note: "Term seats are settled",
    });
    expect(closed.status).toBe(BookingWindowStatus.Closed);
    expect(closed.history[0]?.action).toBe(BookingWindowAction.Close);

    await signIn(ZIAD);
    expect((await getBookingWindow()).status).toBe(BookingWindowStatus.Closed);
    expect((await errorOf(createSubscription(OPEN_LINE, OPEN_STOP))).code).toBe(
      BookingWindowErrorCode.BookingClosed,
    );
  });

  it("reopens until a later time, and refuses an extension that ends earlier", async () => {
    await updateBookingWindow({
      action: BookingWindowAction.Close,
      opens_at: null,
      closes_at: null,
      note: null,
    });
    const reopened = await updateBookingWindow({
      action: BookingWindowAction.Extend,
      opens_at: null,
      closes_at: iso(NOW + 2 * DAY),
      note: null,
    });
    expect(reopened.status).toBe(BookingWindowStatus.Open);
    expect(
      (
        await errorOf(
          updateBookingWindow({
            action: BookingWindowAction.Extend,
            opens_at: null,
            closes_at: iso(NOW + DAY),
            note: null,
          }),
        )
      ).code,
    ).toBe(BookingWindowErrorCode.ExtendMustBeLater);

    await signIn(ZIAD);
    expect((await createSubscription(OPEN_LINE, OPEN_STOP)).status).toBe(
      SubscriptionStatus.Reserved,
    );
  });

  it("closes by itself at the set time", async () => {
    await updateBookingWindow({
      action: BookingWindowAction.Open,
      opens_at: null,
      closes_at: iso(NOW + DAY),
      note: null,
    });
    vi.setSystemTime(NOW + DAY + 1);
    await signIn(ZIAD);
    expect((await getBookingWindow()).status).toBe(BookingWindowStatus.Closed);
    expect((await errorOf(createSubscription(OPEN_LINE, OPEN_STOP))).code).toBe(
      BookingWindowErrorCode.BookingClosed,
    );
  });

  it("lets only the Transportation office change it", async () => {
    await signIn(FINANCE);
    expect(
      (
        await errorOf(
          updateBookingWindow({
            action: BookingWindowAction.Close,
            opens_at: null,
            closes_at: null,
            note: null,
          }),
        )
      ).status,
    ).toBe(403);
  });
});
