import { callEndpoint, type RequestOptions } from "@/lib/api/client";
import { HttpMethod, defineEndpoint } from "@/lib/api/endpoint";
import { Role } from "@/lib/auth/roles";
import {
  sgDayQuerySchema,
  sgOverviewSchema,
  watchBodySchema,
  watchParamsSchema,
  watchlistSchema,
  type SgDayQuery,
  type SgOverview,
  type Watchlist,
} from "./schema";

const TAG = "secretary-general";
const READERS = [Role.SuperAdmin, Role.SecretaryGeneral];

export const getSgOverviewEndpoint = defineEndpoint({
  id: "sg.overview",
  method: HttpMethod.Get,
  path: "/admin/sg/overview",
  summary:
    "One day at a glance, read-only: riding per line (subscribers, rode, not going, absent), " +
    "the latest delay per line, that day's SOS alerts and event buses, and how many violation " +
    "reports wait for Student Affairs. `date` defaults to today; up to 31 days back. " +
    "Errors: DATE_INVALID (422).",
  tag: TAG,
  access: READERS,
  query: sgDayQuerySchema,
  response: sgOverviewSchema,
});

export const getWatchlistEndpoint = defineEndpoint({
  id: "sg.watchlist",
  method: HttpMethod.Get,
  path: "/admin/sg/watchlist",
  summary:
    "The students this account follows and how each one's morning trip went that day " +
    "(waiting, on the bus, arrived, left on the way, not going, absent). Errors: DATE_INVALID.",
  tag: TAG,
  access: READERS,
  query: sgDayQuerySchema,
  response: watchlistSchema,
});

export const watchStudentEndpoint = defineEndpoint({
  id: "sg.watch",
  method: HttpMethod.Post,
  path: "/admin/sg/watchlist",
  summary:
    "Follow a student by university ID (at most 20). Answers today's list. Errors: " +
    "STUDENT_NOT_FOUND (404), ALREADY_WATCHED, WATCHLIST_FULL (409).",
  tag: TAG,
  access: READERS,
  idempotent: true,
  body: watchBodySchema,
  response: watchlistSchema,
});

export const unwatchStudentEndpoint = defineEndpoint({
  id: "sg.unwatch",
  method: HttpMethod.Delete,
  path: "/admin/sg/watchlist/{student_id}",
  summary: "Stop following a student. Answers today's list.",
  tag: TAG,
  access: READERS,
  idempotent: true,
  params: watchParamsSchema,
  response: watchlistSchema,
});

export function getSgOverview(query: SgDayQuery = {}, options?: RequestOptions) {
  return callEndpoint(getSgOverviewEndpoint, { query }, options) satisfies Promise<SgOverview>;
}

export function getWatchlist(query: SgDayQuery = {}, options?: RequestOptions) {
  return callEndpoint(getWatchlistEndpoint, { query }, options) satisfies Promise<Watchlist>;
}

export function watchStudent(identifier: string, options?: RequestOptions): Promise<Watchlist> {
  return callEndpoint(watchStudentEndpoint, { body: { identifier } }, options);
}

export function unwatchStudent(studentId: string, options?: RequestOptions): Promise<Watchlist> {
  return callEndpoint(unwatchStudentEndpoint, { params: { student_id: studentId } }, options);
}

export const sgOfficeEndpoints = [
  getSgOverviewEndpoint,
  getWatchlistEndpoint,
  watchStudentEndpoint,
  unwatchStudentEndpoint,
];
