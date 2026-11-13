import { MockStorage, StoredMap } from "@/lib/api/mock/stored-map";

/** Ahmed, 2026-11-13: every bus leaves campus at 4:30 PM, until the office changes a line. */
export const MOCK_DEFAULT_RETURN_TIME = "16:30";

interface MockReturnTime {
  time: string;
  byName: { ar: string; en: string };
  at: number;
}

/** The lines whose return time the office changed, by line ID. */
const changed = new StoredMap<MockReturnTime>("sut.mock.return-times", MockStorage.Local);

/** When the line's bus leaves campus in the afternoon ("HH:MM", Cairo time). */
export function mockReturnTime(lineId: string): string {
  return changed.get(lineId)?.time ?? MOCK_DEFAULT_RETURN_TIME;
}

export function mockReturnChange(lineId: string): MockReturnTime | null {
  return changed.get(lineId) ?? null;
}

export function saveMockReturnTime(lineId: string, change: MockReturnTime): void {
  changed.set(lineId, change);
}

export function resetReturnTimes(): void {
  changed.clear();
}
