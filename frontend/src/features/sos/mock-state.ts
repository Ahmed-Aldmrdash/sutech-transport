import { MockStorage, StoredMap } from "@/lib/api/mock/stored-map";
import { SosAction, SosStatus, type SosType } from "./schema";

/** Mock only: the Transportation office "takes" an alert this long after it is raised. */
export const MOCK_ACKNOWLEDGE_MS = 15_000;

/** Mock only: who acknowledges, the demo Transportation office account (TRN-1001). */
export const MOCK_OFFICE_RESPONDER = {
  id: "usr_transport_1",
  nameAr: "كريم فتحي",
  nameEn: "Karim Fathy",
} as const;

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
}

const alerts = new StoredMap<MockSos>("sut.mock.sos", MockStorage.Local);

export function saveSos(sos: MockSos): void {
  alerts.set(sos.id, sos);
}

export function findSos(id: string): MockSos | undefined {
  return alerts.get(id);
}

/** The status and log at a moment: the office acknowledges after a few seconds in the mock. */
export function sosProgress(sos: MockSos, now: number) {
  const acknowledgedAt = sos.createdAt + MOCK_ACKNOWLEDGE_MS;
  const acknowledged = now >= acknowledgedAt;
  return {
    status: acknowledged ? SosStatus.Acknowledged : SosStatus.Open,
    actions: acknowledged
      ? [{ action: SosAction.Acknowledge, by: MOCK_OFFICE_RESPONDER.id, at: acknowledgedAt }]
      : [],
  };
}

export function resetSosMock(): void {
  alerts.clear();
}
