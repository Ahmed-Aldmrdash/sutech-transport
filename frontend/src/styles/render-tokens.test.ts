import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import tokens from "../../design/tokens.json";
import { renderTokensCss, type DesignTokens } from "./render-tokens";

type ThemeId = "light" | "dark";
const colours = new Map(
  (tokens as DesignTokens).color.tokens.map((token) => [token.name, token.value]),
);

function hex(name: string, theme: ThemeId): string {
  const value = (colours.get(name) as Record<ThemeId, string> | undefined)?.[theme];
  if (!value?.startsWith("#")) throw new Error(`no plain colour for ${name} (${theme})`);
  return value;
}

function luminance(colour: string): number {
  const linear = (start: number) => {
    const channel = parseInt(colour.slice(start, start + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(1) + 0.7152 * linear(3) + 0.0722 * linear(5);
}

function contrast(foreground: string, background: string): number {
  const one = luminance(foreground);
  const two = luminance(background);
  return (Math.max(one, two) + 0.05) / (Math.min(one, two) + 0.05);
}

/** Text pairs the screens use; each must reach WCAG AA (4.5:1) in both themes. */
const TEXT_PAIRS: readonly [string, string][] = [
  ["ink", "surface"],
  ["ink", "surface-raised"],
  ["ink-muted", "surface"],
  ["brand", "surface"],
  ["brand", "surface-raised"],
  ["brand", "brand-soft"],
  ["on-brand", "brand"],
  ["teal-text", "teal-soft"],
  ["on-teal", "teal"],
  ["coral-text", "surface"],
  ["danger-text", "danger-soft"],
  ["danger-text", "surface"],
  ["danger-text", "surface-raised"],
  ["on-danger", "danger"],
  ["success-text", "success-soft"],
  ["warning-text", "warning-soft"],
];

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

  it.each(TEXT_PAIRS.flatMap(([fg, bg]) => (["light", "dark"] as const).map((t) => [fg, bg, t])))(
    "%s on %s reaches 4.5:1 (%s)",
    (fg, bg, theme) => {
      expect(contrast(hex(fg, theme as ThemeId), hex(bg, theme as ThemeId))).toBeGreaterThanOrEqual(
        4.5,
      );
    },
  );
});
