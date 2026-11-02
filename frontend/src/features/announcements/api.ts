import { callEndpoint, type RequestOptions } from "@/lib/api/client";
import { HttpMethod, defineEndpoint } from "@/lib/api/endpoint";
import { ALL_ROLES } from "@/lib/auth/roles";
import {
  announcementPageSchema,
  listAnnouncementsQuerySchema,
  type AnnouncementPage,
} from "./schema";

export const listAnnouncementsEndpoint = defineEndpoint({
  id: "announcements.list",
  method: HttpMethod.Get,
  path: "/announcements",
  summary:
    "Announcements for the caller, newest first: official notices for everyone, and delays or " +
    "changes on the caller's own line. Text follows Accept-Language.",
  tag: "announcements",
  access: ALL_ROLES,
  query: listAnnouncementsQuerySchema,
  response: announcementPageSchema,
});

export function listAnnouncements(
  query: { page?: number; page_size?: number } = {},
  options?: RequestOptions,
): Promise<AnnouncementPage> {
  return callEndpoint(listAnnouncementsEndpoint, { query }, options);
}

export const announcementsEndpoints = [listAnnouncementsEndpoint];
