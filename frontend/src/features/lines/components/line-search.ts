import { toLatinDigits } from "@/lib/format";
import type { Line } from "../schema";

/** Arabic letters that people type interchangeably: أ إ آ → ا, ة → ه, ى → ي. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[ً-ْ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Matches a line by its number ("12", "14-2") or any part of its name. */
export function matchesLineSearch(line: Line, query: string): boolean {
  const wanted = normalize(toLatinDigits(query));
  if (!wanted) return true;
  if (/^\d+(-\d+)?$/.test(wanted)) {
    return line.code === wanted || line.code.startsWith(`${wanted}-`);
  }
  return normalize(line.name).includes(wanted) || line.code === wanted;
}
