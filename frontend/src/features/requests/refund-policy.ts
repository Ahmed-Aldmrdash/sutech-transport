import { PIASTERS_PER_POUND } from "@/lib/format";
import type { RefundWindow } from "./schema";

const FULL_DEDUCTION = 100;

/**
 * The deduction on a given day ("YYYY-MM-DD"): the first window that hasn't ended yet. Days
 * between two windows (the policy leaves Oct 9–10 and Oct 30–31 out) take the next, stricter
 * window. Before the first window there is no deduction; after the last, everything is kept.
 */
export function deductionOn(windows: readonly RefundWindow[], day: string): number {
  const sorted = [...windows].sort((a, b) => a.from.localeCompare(b.from));
  const first = sorted[0];
  if (!first || day < first.from) return 0;
  const current = sorted.find((window) => window.to === null || day <= window.to);
  return current?.deduction_percent ?? FULL_DEDUCTION;
}

export function isRefundWindowOpen(deductionPercent: number): boolean {
  return deductionPercent < FULL_DEDUCTION;
}

/** What comes back after the deduction, rounded down to whole pounds like a cheque. */
export function refundAmount(paidPiasters: number, deductionPercent: number): number {
  const exact = (paidPiasters * (FULL_DEDUCTION - deductionPercent)) / FULL_DEDUCTION;
  return Math.floor(exact / PIASTERS_PER_POUND) * PIASTERS_PER_POUND;
}
