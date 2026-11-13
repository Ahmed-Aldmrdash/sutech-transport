import { describe, expect, it } from "vitest";
import { formatDateTime, formatMoney, formatMoneyParts, formatTime } from "./format";

describe("formatMoney", () => {
  it("turns piasters into pounds", () => {
    expect(formatMoney(150_000, "en")).toMatch(/1,500/);
    expect(formatMoney(150_000, "en")).toMatch(/EGP/);
  });

  it("keeps Latin digits in Arabic so amounts match receipts", () => {
    expect(formatMoney(150_000, "ar")).toMatch(/1,500/);
  });

  it("shows piasters when the amount has them", () => {
    expect(formatMoney(12_550, "en")).toMatch(/125\.5/);
  });
});

describe("formatMoneyParts", () => {
  it("splits a price into the amount and the currency, in the locale's order", () => {
    expect(formatMoneyParts(1_500_000, "en")).toEqual({
      amount: "15,000",
      currency: "EGP",
      currencyFirst: true,
    });
    expect(formatMoneyParts(1_500_000, "ar")).toEqual({
      amount: "15,000",
      currency: "ج.م.",
      currencyFirst: false,
    });
  });
});

describe("dates", () => {
  // 05:30 UTC is 07:30 in Cairo in winter (UTC+2) — summer time ends in late October.
  const winterUtc = "2026-12-01T05:30:00Z";

  it("always shows Cairo time, whatever the device's time zone", () => {
    expect(formatTime(winterUtc, "en")).toMatch(/07:30/);
  });

  it("formats date and time together", () => {
    expect(formatDateTime(winterUtc, "en")).toMatch(/Dec/);
  });
});

describe("timetable values", () => {
  it("shows an HH:MM timetable time without shifting it", async () => {
    const { formatClockTime, formatCalendarDate, todayInCairo } = await import("./format");
    expect(formatClockTime("07:40", "en")).toMatch(/7:40/);
    expect(formatClockTime("07:40", "ar")).toMatch(/7:40/);
    expect(formatCalendarDate("2027-01-21", "en")).toMatch(/Jan 21, 2027/);
    expect(todayInCairo(new Date("2026-11-01T22:30:00Z"))).toBe("2026-11-02");
  });
});
