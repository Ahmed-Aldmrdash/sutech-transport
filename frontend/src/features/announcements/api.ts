import { callEndpoint, type RequestOptions } from "@/lib/api/client";
import { HttpMethod, defineEndpoint } from "@/lib/api/endpoint";
import { ALL_ROLES, Role } from "@/lib/auth/roles";
import {
  announcementPageSchema,
  announcementSchema,
  createAnnouncementBodySchema,
  type Announcement,
  type CreateAnnouncementBody,
  listAnnouncementsQuerySchema,
  type AnnouncementKind,
  type AnnouncementPage,
} from "./schema";

export const listAnnouncementsEndpoint = defineEndpoint({
  id: "announcements.list",
  method: HttpMethod.Get,
  path: "/announcements",
  summary:
    "Announcements for the caller, newest first: official notices for everyone, and delays or " +
    "changes on the caller's own line. Optional `kind` filter. Text follows Accept-Language. " +
    "Office staff see every line's. Published by the Transportation office " +
    "(POST /admin/announcements); each new one also creates an `announcement` notification.",
  tag: "announcements",
  access: ALL_ROLES,
  query: listAnnouncementsQuerySchema,
  response: announcementPageSchema,
});

export function listAnnouncements(
  query: { kind?: AnnouncementKind; page?: number; page_size?: number } = {},
  options?: RequestOptions,
): Promise<AnnouncementPage> {
  return callEndpoint(listAnnouncementsEndpoint, { query }, options);
}

export const createAnnouncementEndpoint = defineEndpoint({
  id: "announcements.create",
  method: HttpMethod.Post,
  path: "/admin/announcements",
  summary:
    "The Transportation office posts an official notice or a service change, for everyone or " +
    "one line, in Arabic and English. Each reader gets it in their language with an " +
    "`announcement` notification (and Web Push). Logged in the audit log. Errors: " +
    "LINE_NOT_FOUND (404).",
  tag: "announcements",
  access: [Role.SuperAdmin, Role.Transport],
  idempotent: true,
  body: createAnnouncementBodySchema,
  response: announcementSchema,
});

export function createAnnouncement(
  body: CreateAnnouncementBody,
  options?: RequestOptions,
): Promise<Announcement> {
  return callEndpoint(createAnnouncementEndpoint, { body }, options);
}

export const announcementsEndpoints = [listAnnouncementsEndpoint, createAnnouncementEndpoint];
