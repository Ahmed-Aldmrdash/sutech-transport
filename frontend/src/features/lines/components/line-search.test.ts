import { describe, expect, it } from "vitest";
import { matchesLineSearch } from "./line-search";

const line = (code: string, name: string, other = name) => ({
  code,
  name,
  name_ar: name,
  name_en: other,
});

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

  it("finds a line by its name in the other language", () => {
    expect(matchesLineSearch(line("7", "الشروق", "El Shorouk"), "shorouk")).toBe(true);
    expect(matchesLineSearch(line("7", "El Shorouk", "El Shorouk"), "الشروق")).toBe(false);
    const english = { code: "7", name: "El Shorouk", name_ar: "الشروق", name_en: "El Shorouk" };
    expect(matchesLineSearch(english, "الشروق")).toBe(true);
  });
});
