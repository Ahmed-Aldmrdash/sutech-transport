import { describe, expect, it } from "vitest";
import { DB_VERSION } from "@/lib/mock/db";
import { buildSeed } from "@/lib/mock/seed";

describe("mock database", () => {
  it("seeds with the current version, so a saved database survives a reload", () => {
    expect(buildSeed().version).toBe(DB_VERSION);
  });
});
