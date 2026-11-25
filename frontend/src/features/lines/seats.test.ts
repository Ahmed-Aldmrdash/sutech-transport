import { describe, expect, it } from "vitest";

import { MOCK_SEATS_BY_BUS } from "./mock-builders";
import { BusType } from "./schema";

describe("seats per bus type", () => {
  it("uses the seat counts confirmed by the university", () => {
    expect(MOCK_SEATS_BY_BUS[BusType.Coaster]).toBe(21);
    expect(MOCK_SEATS_BY_BUS[BusType.Minibus]).toBe(14);
    expect(MOCK_SEATS_BY_BUS[BusType.LargeBus]).toBe(50);
  });
});
