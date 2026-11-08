/** Each feature's mock, loaded on demand (see MOCK_FEATURE_OF). */
export const MockFeature = {
  Absences: "absences",
  Announcements: "announcements",
  Attendance: "attendance",
  Auth: "auth",
  Card: "card",
  Children: "children",
  Crew: "crew",
  Emergencies: "emergencies",
  Lines: "lines",
  Notifications: "notifications",
  Payments: "payments",
  Requests: "requests",
  Sos: "sos",
  Subscriptions: "subscriptions",
  System: "system",
  Tracking: "tracking",
  Trips: "trips",
  Violations: "violations",
} as const;
export type MockFeatureName = (typeof MockFeature)[keyof typeof MockFeature];
