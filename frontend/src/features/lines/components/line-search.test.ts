import { describe, expect, it } from "vitest";
import type { Line } from "../schema";
import { matchesLineSearch } from "./line-search";

const line = (code: string, name: string) => ({ code, name }) as Line;

describe("line search", () => {
  it("finds a line by number, including its sub-routes", () => {
    expect(matchesLineSearch(line("14-2", "الهرم 2"), "14")).toBe(true);
    expect(matchesLineSearch(line("14-2", "الهرم 2"), "١٤")).toBe(true);
    expect(matchesLineSearch(line("4", "ميت غمر"), "14")).toBe(false);
  });

  it("ignores the hamza and taa marbuta differences people type", () => {
    expect(matchesLineSearch(line("2", "الإسماعيلية"), "الاسماعيليه")).toBe(true);
    expect(matchesLineSearch(line("12", "Nasr City"), "nasr")).toBe(true);
  });
});
