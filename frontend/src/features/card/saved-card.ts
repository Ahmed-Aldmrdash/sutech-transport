import { z } from "zod";
import type { StudentCard } from "./schema";

/**
 * The card's details (never its code) from the last time it opened, so a student without
 * internet can still show who they are and which line they ride. Signing out removes it with
 * every other "sut." key. The offline page reads the same key (see OFFLINE_CARD_SCRIPT).
 */
const SAVED_CARD_KEY = "sut.card.last";

const savedCardSchema = z.object({
  name: z.string(),
  identifier: z.string(),
  line: z.string(),
  stop: z.string(),
  valid_until: z.string(),
});
export type SavedCard = z.infer<typeof savedCardSchema>;

export function saveCard(card: StudentCard): void {
  const saved: SavedCard = {
    name: card.student.name,
    identifier: card.student.identifier,
    line: `${card.line.code} · ${card.line.name}`,
    stop: card.stop.name,
    valid_until: card.valid_until,
  };
  try {
    window.localStorage.setItem(SAVED_CARD_KEY, JSON.stringify(saved));
  } catch {
    // Storage blocked: the card simply isn't available offline.
  }
}

export function readSavedCard(): SavedCard | null {
  try {
    const raw = window.localStorage.getItem(SAVED_CARD_KEY);
    if (!raw) return null;
    const parsed = savedCardSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Runs inline on the offline page, which works with no scripts cached: fills the saved card's
 * fields (elements with data-saved-card="name" and so on) and shows its section.
 */
export const OFFLINE_CARD_SCRIPT = `(function(){try{var c=JSON.parse(localStorage.getItem("${SAVED_CARD_KEY}")||"null");if(!c||!c.name)return;var s=document.getElementById("saved-card");if(!s)return;s.querySelectorAll("[data-saved-card]").forEach(function(e){var v=c[e.getAttribute("data-saved-card")];if(typeof v==="string")e.textContent=v;});s.hidden=false;}catch(e){}})();`;
