import { absencesEndpoints } from "@/features/absences/api";
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
];
