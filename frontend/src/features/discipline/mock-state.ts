import { cairoNow } from "@/lib/api/mock/cairo-clock";
import { MockStorage, StoredMap } from "@/lib/api/mock/stored-map";
import { DisciplineAction, Standing } from "./schema";

/**
 * The mock server's warnings, suspensions and bans. The crew's scan, the booking and the
 * student's pages read it, so a suspension shows up on the bus at once, as with the real server.
 */
export interface MockDisciplineRecord {
  recordId: string;
  studentId: string;
  action: DisciplineAction;
  reason: string;
  startsOn: string;
  endsOn: string | null;
  byId: string;
  createdAt: number;
  liftedAt: number | null;
  liftedById: string | null;
  liftNote: string | null;
}

const records = new StoredMap<MockDisciplineRecord>("sut.mock.discipline", MockStorage.Local);

export function disciplineOf(studentId: string): MockDisciplineRecord[] {
  return [...records.values()]
    .filter((record) => record.studentId === studentId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function findDisciplineRecord(recordId: string): MockDisciplineRecord | undefined {
  return records.get(recordId);
}

export function saveDisciplineRecord(record: MockDisciplineRecord): void {
  records.set(record.recordId, record);
}

/** In force on `date` (a warning always is; a lifted one never is). */
export function isInForce(record: MockDisciplineRecord, date: string): boolean {
  if (record.liftedAt !== null) return false;
  if (record.startsOn > date) return false;
  if (record.action === DisciplineAction.Suspension)
    return record.endsOn !== null && date <= record.endsOn;
  return true;
}

/** The student's standing on a day: banned, else suspended, else warned, else good. */
export function standingOn(studentId: string, date: string): Standing {
  const active = disciplineOf(studentId).filter((record) => isInForce(record, date));
  if (active.some((record) => record.action === DisciplineAction.Ban)) return Standing.Banned;
  if (active.some((record) => record.action === DisciplineAction.Suspension)) {
    return Standing.Suspended;
  }
  return active.length > 0 ? Standing.Warned : Standing.Good;
}

/** Suspended or banned that day: may not ride. */
export function isBlockedFromRiding(studentId: string, date: string): boolean {
  const standing = standingOn(studentId, date);
  return standing === Standing.Suspended || standing === Standing.Banned;
}

export function isBannedNow(studentId: string, now = Date.now()): boolean {
  return standingOn(studentId, cairoNow(new Date(now)).date) === Standing.Banned;
}

/** Test helper. */
export function resetDisciplineMock(): void {
  records.clear();
}
