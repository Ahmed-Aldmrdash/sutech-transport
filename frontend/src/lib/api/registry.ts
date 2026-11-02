import { announcementsEndpoints } from "@/features/announcements/api";
import { authEndpoints } from "@/features/auth/api";
import { cardEndpoints } from "@/features/card/api";
import { linesEndpoints } from "@/features/lines/api";
import { notificationsEndpoints } from "@/features/notifications/api";
import { paymentsEndpoints } from "@/features/payments/api";
import { requestsEndpoints } from "@/features/requests/api";
import { subscriptionsEndpoints } from "@/features/subscriptions/api";
import { systemEndpoints } from "@/features/system/api";
import { tripsEndpoints } from "@/features/trips/api";
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
];
