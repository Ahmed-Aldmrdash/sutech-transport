import { cairoLocalToIso, formatClock } from "@/lib/time";

describe("time helpers", () => {
  it("converts Cairo winter time (UTC+2)", () => {
    expect(cairoLocalToIso("2026-12-01T08:30")).toBe("2026-12-01T06:30:00.000Z");
  });
  it("converts Cairo summer time (UTC+3)", () => {
    expect(cairoLocalToIso("2026-07-01T08:30")).toBe("2026-07-01T05:30:00.000Z");
  });
  it("formats timetable slots", () => {
    expect(formatClock("07:05", "en")).toMatch(/7:05\s?am/i);
  });
});
