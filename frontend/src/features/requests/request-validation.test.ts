import { describe, expect, it } from "vitest";
import {
  isEgyptianMobile,
  normalizePhone,
  validateComplaint,
  validateLineChange,
  validateRefund,
  type LineChangeValues,
} from "./request-validation";

const RULES = { today: "2026-11-02", termStartsOn: "2026-09-26", termEndsOn: "2027-01-21" };
const MAX = 5 * 1024 * 1024;

const lineChange: LineChangeValues = {
  toLineId: "ln_12",
  toStopId: "ln_12_s3",
  duration: "permanent",
  startsOn: "2026-11-02",
  endsOn: "",
  reason: "We moved house near this line.",
  studentPhone: "٠١٠١٢٣٤٥٦٧٨",
  guardianName: "Adel Mahmoud",
  guardianPhone: "+20 109 876 0684",
  guardianConsent: true,
};

describe("request forms", () => {
  it("accepts Egyptian mobiles typed in any common way", () => {
    expect(normalizePhone("+20 109 876 0684")).toBe("01098760684");
    expect(isEgyptianMobile("٠١٠١٢٣٤٥٦٧٨")).toBe(true);
    expect(isEgyptianMobile("0101234567")).toBe(false);
    expect(isEgyptianMobile("01312345678")).toBe(false);
  });

  it("checks the line change form", () => {
    expect(validateLineChange(lineChange, { ...RULES, currentLineId: "ln_05" })).toEqual({});
    expect(
      validateLineChange(
        { ...lineChange, toLineId: "ln_05", guardianConsent: false },
        { ...RULES, currentLineId: "ln_05" },
      ),
    ).toEqual({ toLineId: "sameLine", guardianConsent: "consentRequired" });
    expect(
      validateLineChange(
        { ...lineChange, duration: "temporary", startsOn: "2026-11-01" },
        { ...RULES, currentLineId: "ln_05" },
      ),
    ).toEqual({ startsOn: "dateInPast", endsOn: "required" });
    expect(
      validateLineChange(
        { ...lineChange, duration: "temporary", startsOn: "2026-11-10", endsOn: "2026-11-05" },
        { ...RULES, currentLineId: "ln_05" },
      ),
    ).toEqual({ endsOn: "endBeforeStart" });
  });

  it("asks for documents only for exceptional refunds", () => {
    const base = {
      reason: "standard" as const,
      explanation: "I will drive to campus from now on.",
      guardianName: "Adel Mahmoud",
      guardianPhone: "01098760684",
      guardianConsent: true,
      documents: [],
    };
    expect(validateRefund(base, { maxBytes: MAX })).toEqual({});
    expect(validateRefund({ ...base, reason: "transfer" }, { maxBytes: MAX })).toEqual({
      documents: "documentsRequired",
    });
    const exe = new File(["x"], "virus.exe", { type: "application/x-msdownload" });
    expect(validateRefund({ ...base, documents: [exe] }, { maxBytes: MAX })).toEqual({
      documents: "fileType",
    });
  });

  it("checks the complaint date is this term and not ahead", () => {
    const base = {
      category: "delay" as const,
      lineId: "",
      happenedOn: "2026-11-03",
      description: "short",
      attachments: [],
    };
    expect(validateComplaint(base, { ...RULES, maxBytes: MAX })).toEqual({
      happenedOn: "dateInFuture",
      description: "textTooShort",
    });
    expect(
      validateComplaint(
        { ...base, happenedOn: "2026-09-01", description: "The bus skipped my stop." },
        { ...RULES, maxBytes: MAX },
      ),
    ).toEqual({ happenedOn: "dateBeforeTerm" });
  });
});
