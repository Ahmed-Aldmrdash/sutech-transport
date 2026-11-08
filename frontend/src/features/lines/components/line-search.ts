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

type Searchable = Pick<Line, "code" | "name" | "name_ar" | "name_en">;

/** Matches a line by its number ("12", "14-2") or any part of its name, in either language. */
export function matchesLineSearch(line: Searchable, query: string): boolean {
  const wanted = normalize(toLatinDigits(query));
  if (!wanted) return true;
  if (/^\d+(-\d+)?$/.test(wanted)) {
    return line.code === wanted || line.code.startsWith(`${wanted}-`);
  }
  return [line.name, line.name_ar, line.name_en].some((name) => normalize(name).includes(wanted));
}
