import { describe, expect, it } from "vitest";
import { formatDateTime, formatMoney, formatTime } from "./format";

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
