/** Shared status tones. Colour never stands alone: every tone is shown with a word or an icon. */
export const Tone = {
  Neutral: "neutral",
  Brand: "brand",
  Info: "info",
  Success: "success",
  Warning: "warning",
  Danger: "danger",
} as const;
export type Tone = (typeof Tone)[keyof typeof Tone];

export const SOFT_TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-surface-alt text-ink border-line",
  brand: "bg-brand-soft text-brand border-brand-soft",
  info: "bg-teal-soft text-teal-text border-teal-soft",
  success: "bg-success-soft text-success-text border-success-soft",
  warning: "bg-warning-soft text-warning-text border-warning-soft",
  danger: "bg-danger-soft text-danger border-danger-soft",
};
