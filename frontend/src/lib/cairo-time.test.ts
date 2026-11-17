import { describe, expect, it } from "vitest";
import { cairoLocalToIso, isoToCairoLocal } from "./cairo-time";

describe("Cairo date-time fields", () => {
  it("reads a winter time as UTC+2", () => {
    expect(cairoLocalToIso("2026-12-01T10:00")).toBe("2026-12-01T08:00:00.000Z");
  });

  it("reads a summer time as UTC+3", () => {
    expect(cairoLocalToIso("2026-07-01T10:00")).toBe("2026-07-01T07:00:00.000Z");
  });

  it("goes back to the same wall clock", () => {
    expect(isoToCairoLocal("2026-12-01T08:00:00.000Z")).toBe("2026-12-01T10:00");
  });

  it("refuses a value that isn't a date", () => {
    expect(cairoLocalToIso("")).toBeNull();
  });
});
