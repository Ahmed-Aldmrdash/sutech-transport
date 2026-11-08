import { describe, expect, it } from "vitest";
import { poundsToPiasters, validateReceipt, type ReceiptFormValues } from "./receipt-validation";

const RULES = {
  minimumPiasters: 1_500_000,
  maxBytes: 5 * 1024 * 1024,
  today: "2026-11-02",
  earliestPaidOn: "2026-10-28",
};

function values(overrides: Partial<ReceiptFormValues> = {}): ReceiptFormValues {
  return {
    method: "bank_deposit",
    reference: "NBE-123456",
    amount: "15000",
    paidOn: "2026-11-01",
    payer: "Tamer Nour",
    file: new File(["x"], "slip.jpg", { type: "image/jpeg" }),
    ...overrides,
  };
}

describe("receipt form", () => {
  it("refuses an amount far over the price, fractions of a piaster, and old dates", () => {
    expect(validateReceipt(values({ amount: "99999999" }), RULES).amount).toBe("amountTooHigh");
    expect(validateReceipt(values({ amount: "16500" }), RULES).amount).toBeUndefined();
    expect(validateReceipt(values({ amount: "15000.555" }), RULES).amount).toBe("amountInvalid");
    expect(validateReceipt(values({ amount: "15000.55" }), RULES).amount).toBeUndefined();
    expect(validateReceipt(values({ paidOn: "2020-01-01" }), RULES).paidOn).toBe("dateTooEarly");
    expect(validateReceipt(values({ paidOn: "2026-10-28" }), RULES).paidOn).toBeUndefined();
  });

  it("accepts a complete receipt", () => {
    expect(validateReceipt(values(), RULES)).toEqual({});
  });

  it("reads Arabic digits and commas in the amount", () => {
    expect(poundsToPiasters("١٥٬٠٠٠")).toBe(1_500_000);
    expect(poundsToPiasters("15,000.50")).toBe(1_500_050);
    expect(poundsToPiasters("abc")).toBeNull();
  });

  it("explains each missing or wrong field", () => {
    const errors = validateReceipt(
      values({ reference: "", amount: "100", paidOn: "2026-11-03", payer: "Al", file: null }),
      RULES,
    );
    expect(errors).toEqual({
      reference: "required",
      amount: "amountTooLow",
      paidOn: "dateInFuture",
      payer: "payerTooShort",
      file: "fileMissing",
    });
  });

  it("allows only JPG, PNG or PDF up to the size limit", () => {
    const text = new File(["x"], "a.txt", { type: "text/plain" });
    expect(validateReceipt(values({ file: text }), RULES).file).toBe("fileType");
    const big = new File([new Uint8Array(RULES.maxBytes + 1)], "big.pdf", {
      type: "application/pdf",
    });
    expect(validateReceipt(values({ file: big }), RULES).file).toBe("fileTooLarge");
  });
});
