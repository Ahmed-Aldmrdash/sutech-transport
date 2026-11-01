/**
 * Pure renderer from the design system's tokens.json to CSS custom properties.
 * Shared by scripts/generate-tokens.ts and the test that keeps tokens.css in sync.
 */

type ThemedValue = string | { light: string; dark?: string };

interface TokenEntry {
  name: string;
  value: ThemedValue;
}

interface TokenFamily {
  tokens: TokenEntry[];
}

export interface DesignTokens {
  name: string;
  version: number;
  color: TokenFamily;
  spacing: TokenFamily;
  radius: TokenFamily;
  shadow: TokenFamily;
  size: TokenFamily;
}

const PREFIX = "--sut-";
const ALIAS = /^\{([a-z0-9-]+)\}$/i;

function resolve(value: string): string {
  const alias = ALIAS.exec(value);
  return alias ? `var(${PREFIX}${alias[1]})` : value;
}

function lightValue(value: ThemedValue): string {
  return resolve(typeof value === "string" ? value : value.light);
}

function darkValue(value: ThemedValue): string | null {
  if (typeof value === "string" || value.dark === undefined) return null;
  return value.dark === value.light ? null : resolve(value.dark);
}

export function renderTokensCss(tokens: DesignTokens): string {
  const families = [tokens.color, tokens.spacing, tokens.radius, tokens.shadow, tokens.size];
  const entries = families.flatMap((family) => family.tokens);

  const light = entries.map((t) => `  ${PREFIX}${t.name}: ${lightValue(t.value)};`);
  const dark = entries.flatMap((t) => {
    const value = darkValue(t.value);
    return value === null ? [] : [`  ${PREFIX}${t.name}: ${value};`];
  });

  return [
    `/* ${tokens.name} design tokens v${tokens.version}. Generated from design/tokens.json by`,
    "   scripts/generate-tokens.ts. Do not edit by hand: run `npm run tokens`. */",
    "",
    ":root {",
    "  color-scheme: light;",
    ...light,
    "}",
    "",
    ':root[data-theme="dark"] {',
    "  color-scheme: dark;",
    ...dark,
    "}",
    "",
  ].join("\n");
}
