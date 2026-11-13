import { describe, expect, it } from "vitest";
import { isoDateTime } from "./iso-datetime";

describe("isoDateTime", () => {
  const schema = isoDateTime();

  it("keeps a UTC time with Z as sent", () => {
    expect(schema.parse("2026-11-13T10:00:00Z")).toBe("2026-11-13T10:00:00Z");
    expect(schema.parse("2026-11-13T10:00:00.250Z")).toBe("2026-11-13T10:00:00.250Z");
  });

  it("accepts +00:00 (Python's isoformat) and any offset, as the same moment in Z", () => {
    expect(schema.parse("2026-11-13T10:00:00+00:00")).toBe("2026-11-13T10:00:00.000Z");
    expect(schema.parse("2026-11-13T12:00:00+02:00")).toBe("2026-11-13T10:00:00.000Z");
    expect(schema.parse("2026-11-13T09:30:00.5-00:30")).toBe("2026-11-13T10:00:00.500Z");
  });

  it("still refuses a time with no zone, a bare date and garbage", () => {
    expect(schema.safeParse("2026-11-13T10:00:00").success).toBe(false);
    expect(schema.safeParse("2026-11-13").success).toBe(false);
    expect(schema.safeParse("yesterday").success).toBe(false);
  });

  it("works inside nullable fields", () => {
    expect(schema.nullable().parse(null)).toBeNull();
    expect(schema.nullable().parse("2026-11-13T10:00:00+00:00")).toBe("2026-11-13T10:00:00.000Z");
  });
});
