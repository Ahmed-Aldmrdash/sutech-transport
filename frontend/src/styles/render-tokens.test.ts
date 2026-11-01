import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import tokens from "../../design/tokens.json";
import { renderTokensCss, type DesignTokens } from "./render-tokens";

describe("design tokens", () => {
  const css = renderTokensCss(tokens as DesignTokens);

  it("tokens.css is up to date with design/tokens.json (run `npm run tokens`)", () => {
    const onDisk = readFileSync(path.join(import.meta.dirname, "tokens.css"), "utf8");
    expect(onDisk).toBe(css);
  });

  it("keeps the official brand colours", () => {
    expect(css).toContain("--sut-brand: #58286e;");
    expect(css).toContain("--sut-teal: #257988;");
    expect(css).toContain("--sut-coral: #cf644b;");
  });

  it("defines dark values and resolves aliases", () => {
    expect(css).toMatch(/\[data-theme="dark"\][\s\S]*--sut-surface: #16101a;/);
    expect(css).toContain("--sut-focus: var(--sut-teal);");
  });
});
