import { describe, expect, it } from "vitest";
import { deductionOn, isRefundWindowOpen, refundAmount } from "./refund-policy";

const WINDOWS = [
  { from: "2026-09-20", to: "2026-10-08", deduction_percent: 25 },
  { from: "2026-10-11", to: "2026-10-29", deduction_percent: 50 },
  { from: "2026-11-01", to: null, deduction_percent: 100 },
];

describe("refund policy (Fall 2026)", () => {
  it("follows the dated table", () => {
    expect(deductionOn(WINDOWS, "2026-09-10")).toBe(0);
    expect(deductionOn(WINDOWS, "2026-09-20")).toBe(25);
    expect(deductionOn(WINDOWS, "2026-10-08")).toBe(25);
    expect(deductionOn(WINDOWS, "2026-10-20")).toBe(50);
    expect(deductionOn(WINDOWS, "2026-11-01")).toBe(100);
    expect(deductionOn(WINDOWS, "2027-01-10")).toBe(100);
  });

  it("days the policy leaves out take the next, stricter row", () => {
    expect(deductionOn(WINDOWS, "2026-10-09")).toBe(50);
    expect(deductionOn(WINDOWS, "2026-10-31")).toBe(100);
  });

  it("works out the cheque in whole pounds", () => {
    expect(refundAmount(1_500_000, 25)).toBe(1_125_000);
    expect(refundAmount(1_500_000, 50)).toBe(750_000);
    expect(refundAmount(1_500_050, 25)).toBe(1_125_000);
    expect(refundAmount(1_500_000, 100)).toBe(0);
    expect(isRefundWindowOpen(50)).toBe(true);
    expect(isRefundWindowOpen(100)).toBe(false);
  });
});
