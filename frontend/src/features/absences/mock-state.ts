import { MockStorage, StoredMap } from "@/lib/api/mock/stored-map";
import type { AbsenceReason } from "./schema";

/** Mock only: each student's "not going" days, kept in localStorage like the bookings. */
export interface MockAbsence {
  absenceId: string;
  serviceDate: string;
  reason: AbsenceReason;
  note: string | null;
  createdAt: number;
}

const absences = new StoredMap<MockAbsence[]>("sut.mock.absences", MockStorage.Local);

export function absencesOf(userId: string): MockAbsence[] {
  return absences.get(userId) ?? [];
}

export function saveAbsences(userId: string, list: MockAbsence[]): void {
  absences.set(userId, list);
}

/** Days the student said they won't ride, for the trips history. */
export function notGoingDatesOf(userId: string): Set<string> {
  return new Set(absencesOf(userId).map((item) => item.serviceDate));
}

export function resetAbsencesMock(): void {
  absences.clear();
}
