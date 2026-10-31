import type { Endpoint } from "./endpoint";
import { endpoints as announcements } from "@/features/announcements/api";
import { endpoints as attendance } from "@/features/attendance/api";
import { endpoints as auth } from "@/features/auth/api";
import { endpoints as card } from "@/features/card/api";
import { endpoints as chat } from "@/features/chat/api";
import { endpoints as clinic } from "@/features/clinic/api";
import { endpoints as complaints } from "@/features/complaints/api";
import { endpoints as departures } from "@/features/departures/api";
import { endpoints as events } from "@/features/events/api";
import { endpoints as fleet } from "@/features/fleet/api";
import { endpoints as lines } from "@/features/lines/api";
import { endpoints as notifications } from "@/features/notifications/api";
import { endpoints as overview } from "@/features/overview/api";
import { endpoints as parent } from "@/features/parent/api";
import { adminEndpoints as paymentReview, endpoints as payments } from "@/features/payments/api";
import { endpoints as reports } from "@/features/reports/api";
import { endpoints as requests } from "@/features/requests/api";
import { endpoints as sos } from "@/features/sos/api";
import { endpoints as students } from "@/features/students/api";
import { endpoints as subscriptions } from "@/features/subscriptions/api";
import { endpoints as term } from "@/features/term/api";
import { endpoints as tracking } from "@/features/tracking/api";
import { endpoints as trips } from "@/features/trips/api";
import { endpoints as violations } from "@/features/violations/api";

/** Every endpoint the front end uses. The OpenAPI generator and the contract test read this list. */
export const ALL_ENDPOINTS: Endpoint[] = [
  auth,
  lines,
  term,
  subscriptions,
  payments,
  paymentReview,
  card,
  attendance,
  tracking,
  departures,
  announcements,
  notifications,
  requests,
  complaints,
  chat,
  parent,
  trips,
  sos,
  violations,
  fleet,
  students,
  overview,
  reports,
  clinic,
  events,
].flatMap((group) => Object.values(group) as Endpoint[]);
