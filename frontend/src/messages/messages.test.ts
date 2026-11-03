import { describe, expect, it } from "vitest";
import ar from "./ar.json";
import en from "./en.json";

function keys(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    keys(child, prefix ? `${prefix}.${key}` : key),
  );
}

/**
 * Argument names, e.g. "{count, plural, =1 {…} other {…}}" → ["count"]. Plural and select cases
 * may differ; a case's text ("{You aren't…}") isn't a name because no "," or "}" follows it.
 */
function placeholders(text: string): string[] {
  const names = [...text.matchAll(/\{([A-Za-z_]\w*)\s*[,}]/g)].map((match) => match[1] ?? "");
  return [...new Set(names)].sort();
}

function lookup(source: unknown, key: string): string {
  return key
    .split(".")
    .reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], source) as string;
}

describe("translations", () => {
  it("Arabic and English have exactly the same keys", () => {
    expect(keys(ar).sort()).toEqual(keys(en).sort());
  });

  it("no translation is empty", () => {
    for (const key of keys(en)) {
      expect(lookup(en, key), `en ${key}`).not.toBe("");
      expect(lookup(ar, key), `ar ${key}`).not.toBe("");
    }
  });

  it("placeholders match between the two languages", () => {
    for (const key of keys(en)) {
      expect(placeholders(lookup(ar, key)), key).toEqual(placeholders(lookup(en, key)));
    }
  });
});
