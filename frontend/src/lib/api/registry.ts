import { absencesEndpoints } from "@/features/absences/api";
import { adminSystemEndpoints } from "@/features/admin-system/api";
import { announcementsEndpoints } from "@/features/announcements/api";
import { attendanceEndpoints } from "@/features/attendance/api";
import { authEndpoints } from "@/features/auth/api";
import { cardEndpoints } from "@/features/card/api";
import { childrenEndpoints } from "@/features/children/api";
import { crewEndpoints } from "@/features/crew/api";
import { linesEndpoints } from "@/features/lines/api";
import { notificationsEndpoints } from "@/features/notifications/api";
import { paymentsEndpoints } from "@/features/payments/api";
import { requestsEndpoints } from "@/features/requests/api";
import { emergenciesEndpoints } from "@/features/emergencies/api";
import { eventBusesEndpoints } from "@/features/event-buses/api";
import { financeDeskEndpoints } from "@/features/finance-desk/api";
import { opsDeskEndpoints } from "@/features/ops-desk/api";
import { reportsEndpoints } from "@/features/reports/api";
import { requestDeskEndpoints } from "@/features/request-desk/api";
import { sgOfficeEndpoints } from "@/features/sg-office/api";
import { violationDeskEndpoints } from "@/features/violation-desk/api";
import { sosEndpoints } from "@/features/sos/api";
import { subscriptionsEndpoints } from "@/features/subscriptions/api";
import { systemEndpoints } from "@/features/system/api";
import { trackingEndpoints } from "@/features/tracking/api";
import { tripsEndpoints } from "@/features/trips/api";
import { violationsEndpoints } from "@/features/violations/api";
import type { Endpoint } from "./endpoint";

/**
 * Every endpoint in the app, used by `npm run openapi`. Add each feature's list here.
 * A test fails if two endpoints share an id or a method + path.
 */
export const allEndpoints: readonly Endpoint[] = [
  ...authEndpoints,
  ...systemEndpoints,
  ...linesEndpoints,
  ...subscriptionsEndpoints,
  ...paymentsEndpoints,
  ...cardEndpoints,
  ...tripsEndpoints,
  ...announcementsEndpoints,
  ...requestsEndpoints,
  ...notificationsEndpoints,
  ...absencesEndpoints,
  ...attendanceEndpoints,
  ...trackingEndpoints,
  ...childrenEndpoints,
  ...crewEndpoints,
  ...sosEndpoints,
  ...emergenciesEndpoints,
  ...violationsEndpoints,
  ...financeDeskEndpoints,
  ...requestDeskEndpoints,
  ...violationDeskEndpoints,
  ...reportsEndpoints,
  ...eventBusesEndpoints,
  ...sgOfficeEndpoints,
  ...opsDeskEndpoints,
  ...adminSystemEndpoints,
];
