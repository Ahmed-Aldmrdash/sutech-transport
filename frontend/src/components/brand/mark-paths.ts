/**
 * The shapes of the project's mark (the "S road"), as in public/brand/sutech-transport-mark.svg
 * (viewBox 0 0 512 512). Never redraw or edit them.
 */
export const MARK_VIEWBOX = "0 0 512 512";

export const MARK = {
  road: "M372,104 H216 A80,80 0 0 0 216,264 H296 A80,80 0 0 1 296,424 H232",
  roadWidth: 76,
  stop: { cx: 398, cy: 104, r: 58, hole: 23.2 },
  pin: "M171.9,399.3 A60,60 0 1 0 72.1,399.3 L111.0,457.6 Q122,474 133.0,457.6 Z",
  pinHole: { cx: 122, cy: 366, r: 24 },
} as const;
