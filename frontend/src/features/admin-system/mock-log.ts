import type { MockAccount } from "@/features/auth/mock-accounts";
import { MockStorage, StoredMap } from "@/lib/api/mock/stored-map";
import type { Role } from "@/lib/auth/roles";
import type { AuditAction } from "./schema";

/**
 * The mock server's activity log: every office decision writes one line, as the real server
 * must (agreement: "logged in the audit log"). Kept in this browser with the rest of the demo.
 */

export interface Bilingual {
  ar: string;
  en: string;
}

export interface MockAuditEntry {
  id: string;
  at: number;
  actorId: string;
  actorIdentifier: string;
  actorName: Bilingual;
  actorRole: Role;
  action: AuditAction;
  target: Bilingual;
  detail: Bilingual | null;
}

const log = new StoredMap<MockAuditEntry>("sut.mock.audit", MockStorage.Local);

/** Same text in both languages: IDs, plates, references. */
export const both = (text: string): Bilingual => ({ ar: text, en: text });

export function recordAudit(
  actor: MockAccount,
  action: AuditAction,
  target: Bilingual,
  detail: Bilingual | string | null = null,
  at: number = Date.now(),
): void {
  const id = `aud_${at.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  log.set(id, {
    id,
    at,
    actorId: actor.user.id,
    actorIdentifier: actor.user.identifier,
    actorName: { ar: actor.user.name_ar ?? actor.user.name, en: actor.user.name },
    actorRole: actor.user.role,
    action,
    target,
    detail: typeof detail === "string" ? (detail.trim() ? both(detail.trim()) : null) : detail,
  });
}

/** Everything recorded in this browser, newest first. */
export function recordedAudit(): MockAuditEntry[] {
  return [...log.values()].sort((a, b) => b.at - a.at);
}

/** Test helper. */
export function resetAudit(): void {
  log.clear();
}

/** "240100102 · سيف حسام لطفي": a student as a log line names them. */
export function studentTarget(
  student: { identifier: string; nameAr: string; nameEn: string },
  prefix?: string,
): Bilingual {
  const lead = prefix ? `${prefix} · ` : "";
  return {
    ar: `${lead}${student.identifier} · ${student.nameAr}`,
    en: `${lead}${student.identifier} · ${student.nameEn}`,
  };
}
