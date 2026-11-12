import type { Endpoint } from "../endpoint";
import { MockFeature, type MockFeatureName } from "./mock-features";
import { MOCK_FEATURE_OF } from "./mock-routing";

/**
 * Loads the mock handlers an endpoint needs. Imported lazily, only in mock mode, so none of the
 * mock data ends up in the production bundle when the app talks to the real server.
 * Add one line per feature that has a mock.ts (and its endpoints to MOCK_FEATURE_OF).
 */
const LOADERS: Record<MockFeatureName, () => Promise<unknown>> = {
  [MockFeature.Absences]: () => import("@/features/absences/mock"),
  [MockFeature.Announcements]: () => import("@/features/announcements/mock"),
  [MockFeature.Attendance]: () => import("@/features/attendance/mock"),
  [MockFeature.Auth]: () => import("@/features/auth/mock"),
  [MockFeature.Card]: () => import("@/features/card/mock"),
  [MockFeature.Children]: () => import("@/features/children/mock"),
  [MockFeature.Crew]: () => import("@/features/crew/mock"),
  [MockFeature.Emergencies]: () => import("@/features/emergencies/mock"),
  [MockFeature.FinanceDesk]: () => import("@/features/finance-desk/mock"),
  [MockFeature.Lines]: () => import("@/features/lines/mock"),
  [MockFeature.Notifications]: () => import("@/features/notifications/mock"),
  [MockFeature.Payments]: () => import("@/features/payments/mock"),
  [MockFeature.Reports]: () => import("@/features/reports/mock"),
  [MockFeature.Requests]: () => import("@/features/requests/mock"),
  [MockFeature.RequestDesk]: () => import("@/features/request-desk/mock"),
  [MockFeature.Sos]: () => import("@/features/sos/mock"),
  [MockFeature.Subscriptions]: () => import("@/features/subscriptions/mock"),
  [MockFeature.System]: () => import("@/features/system/mock"),
  [MockFeature.Tracking]: () => import("@/features/tracking/mock"),
  [MockFeature.Trips]: () => import("@/features/trips/mock"),
  [MockFeature.Violations]: () => import("@/features/violations/mock"),
  [MockFeature.ViolationDesk]: () => import("@/features/violation-desk/mock"),
};

export function loadMockFeature(feature: MockFeatureName): Promise<unknown> {
  return LOADERS[feature]();
}

/** The mock for this endpoint, or every mock if the endpoint isn't mapped (a new one). */
export async function loadMocksFor(endpoint: Endpoint): Promise<void> {
  const feature = MOCK_FEATURE_OF[endpoint.id];
  if (feature) {
    await loadMockFeature(feature);
    return;
  }
  await Promise.all(Object.values(LOADERS).map((load) => load()));
}
