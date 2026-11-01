/**
 * Turns design/tokens.json (exported from the SUtech design system) into
 * src/styles/tokens.css: one CSS custom property per token, with a light block
 * and a dark block. Run with `npm run tokens`. Never edit tokens.css by hand.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { renderTokensCss, type DesignTokens } from "../src/styles/render-tokens";

const root = path.resolve(import.meta.dirname, "..");
const tokens = JSON.parse(
  readFileSync(path.join(root, "design/tokens.json"), "utf8"),
) as DesignTokens;

writeFileSync(path.join(root, "src/styles/tokens.css"), renderTokensCss(tokens));
console.log("Wrote src/styles/tokens.css");
