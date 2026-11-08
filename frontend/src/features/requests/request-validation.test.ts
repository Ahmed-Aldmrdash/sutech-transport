import { describe, expect, it } from "vitest";
import {
  isEgyptianMobile,
  normalizePhone,
  validateComplaint,
  validateLineChange,
  validateModelPermit,
  validateRefund,
  type LineChangeValues,
  type ModelPermitValues,
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
  guardianPhone: "+20 100 000 7684",
};

const modelPermit: ModelPermitValues = {
  material: "Wood",
  dimensions: "60 × 40 cm",
  purpose: "display",
  purposeOther: "",
  destination: "Exhibition hall",
  entryDate: "2026-11-05",
  entryTime: "07:30",
  exitDate: "2026-11-05",
  exitTime: "16:00",
  supervisorName: "Dr. Nihal",
  declarationAccepted: true,
};

describe("request forms", () => {
  it("checks the model permit form", () => {
    expect(validateModelPermit(modelPermit, RULES)).toEqual({});
    expect(
      validateModelPermit(
        {
          ...modelPermit,
          purpose: "other",
          entryDate: "2026-11-01",
          exitTime: "07:00",
          declarationAccepted: false,
        },
        RULES,
      ),
    ).toEqual({
      purposeOther: "required",
      entryDate: "dateInPast",
      declarationAccepted: "declarationRequired",
    });
    expect(validateModelPermit({ ...modelPermit, exitTime: "07:00" }, RULES)).toEqual({
      exitTime: "exitBeforeEntry",
    });
    expect(validateModelPermit({ ...modelPermit, exitDate: "2026-11-04" }, RULES)).toEqual({
      exitDate: "exitBeforeEntry",
    });
  });

  it("accepts Egyptian mobiles typed in any common way", () => {
    expect(normalizePhone("+20 100 000 7684")).toBe("01000007684");
    expect(isEgyptianMobile("٠١٠١٢٣٤٥٦٧٨")).toBe(true);
    expect(isEgyptianMobile("0101234567")).toBe(false);
    expect(isEgyptianMobile("01312345678")).toBe(false);
  });

  it("checks the line change form", () => {
    expect(validateLineChange(lineChange, { ...RULES, currentLineId: "ln_05" })).toEqual({});
    expect(
      validateLineChange(
        { ...lineChange, toLineId: "ln_05", guardianPhone: "" },
        { ...RULES, currentLineId: "ln_05" },
      ),
    ).toEqual({ toLineId: "sameLine", guardianPhone: "required" });
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
      guardianPhone: "01000007684",
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
