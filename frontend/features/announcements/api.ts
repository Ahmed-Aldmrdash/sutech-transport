import { call } from "@/lib/api/client";
import { Ok } from "@/lib/api/common";
import { defineEndpoint } from "@/lib/api/endpoint";
import { ALL_ROLES, Role } from "@/features/auth/roles";
import {
  ActiveDelay,
  AdminAnnouncements,
  Announcement,
  AnnouncementList,
  type NewAnnouncement as NewAnnouncementInput,
  NewAnnouncement,
  PinUpdate,
} from "./schema";
import { z } from "zod";

const OPERATIONS = [Role.SuperAdmin, Role.TransportAdmin] as const;

export const endpoints = {
  list: defineEndpoint({
    tag: "announcements",
    method: "GET",
    path: "/announcements",
    summary:
      "Announcements for the caller: official ones for everyone, line alerts for the student's line (or a parent's children's lines).",
    roles: ALL_ROLES,
    response: AnnouncementList,
  }),
  adminList: defineEndpoint({
    tag: "announcements",
    method: "GET",
    path: "/admin/announcements",
    summary: "Published and scheduled announcements.",
    roles: OPERATIONS,
    response: AdminAnnouncements,
  }),
  create: defineEndpoint({
    tag: "announcements",
    method: "POST",
    path: "/admin/announcements",
    summary: "Publish now or schedule an announcement. A delay also sets the line's ETA offset.",
    roles: OPERATIONS,
    body: NewAnnouncement,
    response: Ok,
    idempotent: true,
  }),
  pin: defineEndpoint({
    tag: "announcements",
    method: "PATCH",
    path: "/admin/announcements/{announcement_id}",
    summary: "Pin or unpin an official announcement on the students' home screen.",
    roles: OPERATIONS,
    body: PinUpdate,
    response: Announcement,
  }),
  remove: defineEndpoint({
    tag: "announcements",
    method: "DELETE",
    path: "/admin/announcements/{announcement_id}",
    summary:
      "Delete an announcement for everyone: it disappears from students and parents together with the notifications it sent, and any delay it set is cleared.",
    roles: OPERATIONS,
    response: Ok,
  }),
  publishScheduled: defineEndpoint({
    tag: "announcements",
    method: "POST",
    path: "/admin/announcements/scheduled/{scheduled_id}/publish",
    summary: "Publish a scheduled announcement now.",
    roles: OPERATIONS,
    response: Ok,
  }),
  cancelScheduled: defineEndpoint({
    tag: "announcements",
    method: "DELETE",
    path: "/admin/announcements/scheduled/{scheduled_id}",
    summary: "Cancel a scheduled announcement before it goes out.",
    roles: OPERATIONS,
    response: Ok,
  }),
  delays: defineEndpoint({
    tag: "announcements",
    method: "GET",
    path: "/admin/delays",
    summary: "Lines running late right now.",
    roles: OPERATIONS,
    response: z.array(ActiveDelay),
  }),
  clearDelay: defineEndpoint({
    tag: "announcements",
    method: "POST",
    path: "/admin/delays/{line_id}/clear",
    summary: "Back on schedule: ends the delay and tells the line's students.",
    roles: [...OPERATIONS, Role.Driver],
    response: Ok,
  }),
};

export const listAnnouncements = () => call(endpoints.list);
export const listAdminAnnouncements = () => call(endpoints.adminList);
export const createAnnouncement = (body: NewAnnouncementInput) => call(endpoints.create, { body });
export const pinAnnouncement = (id: string, pinned: boolean) =>
  call(endpoints.pin, { params: { announcement_id: id }, body: { pinned } });
export const deleteAnnouncement = (id: string) => call(endpoints.remove, { params: { announcement_id: id } });
export const publishScheduled = (id: string) => call(endpoints.publishScheduled, { params: { scheduled_id: id } });
export const cancelScheduled = (id: string) => call(endpoints.cancelScheduled, { params: { scheduled_id: id } });
export const listDelays = () => call(endpoints.delays);
export const clearDelay = (lineId: string) => call(endpoints.clearDelay, { params: { line_id: lineId } });
