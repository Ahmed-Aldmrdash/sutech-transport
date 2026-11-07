import { MockStorage, StoredMap } from "@/lib/api/mock/stored-map";
import { SosAction, SosStatus, type SosType } from "./schema";

/** One line of the office's log on an alert. Never edited or deleted. */
export interface MockSosActionEntry {
  action: SosAction;
  /** User id of the office member (or the system, for a replacement sent from the trip). */
  by: string;
  at: number;
  note: string | null;
  /** For `replacement_sent`: the bus or driver change on the trip, worded when read. */
  replacementId?: string;
}

export interface MockSos {
  id: string;
  type: SosType;
  note: string | null;
  tripId: string;
  lineId: string;
  raisedBy: string;
  location: { lat: number; lng: number; fixAt: number } | null;
  ridersOnBoard: number;
  createdAt: number;
  idempotencyKey: string | null;
  /** Oldest first. Missing on alerts stored before the office page existed. */
  actions?: MockSosActionEntry[];
}

const alerts = new StoredMap<MockSos>("sut.mock.sos", MockStorage.Local);

export function saveSos(sos: MockSos): void {
  alerts.set(sos.id, sos);
}

export function findSos(id: string): MockSos | undefined {
  return alerts.get(id);
}

/** Every alert, newest first. */
export function allSos(): MockSos[] {
  return [...alerts.values()].sort((a, b) => b.createdAt - a.createdAt);
}

export function actionsOf(sos: MockSos): MockSosActionEntry[] {
  return sos.actions ?? [];
}

/** open → acknowledged → closed, read from the office's log. */
export function sosStatusOf(sos: MockSos): SosStatus {
  const actions = actionsOf(sos);
  if (actions.some((entry) => entry.action === SosAction.Close)) return SosStatus.Closed;
  if (actions.some((entry) => entry.action === SosAction.Acknowledge)) {
    return SosStatus.Acknowledged;
  }
  return SosStatus.Open;
}

export function addSosAction(sos: MockSos, entry: MockSosActionEntry): MockSos {
  const updated = { ...sos, actions: [...actionsOf(sos), entry] };
  saveSos(updated);
  return updated;
}

export function resetSosMock(): void {
  alerts.clear();
}
