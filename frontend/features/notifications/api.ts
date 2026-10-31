import { call } from "@/lib/api/client";
import { Ok } from "@/lib/api/common";
import { defineEndpoint } from "@/lib/api/endpoint";
import { ALL_ROLES, Role } from "@/features/auth/roles";
import { NotificationList, NotificationPreferences } from "./schema";

export const endpoints = {
  list: defineEndpoint({
    tag: "notifications",
    method: "GET",
    path: "/notifications",
    summary: "The caller's notifications, newest first, with the unread count.",
    roles: ALL_ROLES,
    response: NotificationList,
  }),
  readAll: defineEndpoint({
    tag: "notifications",
    method: "POST",
    path: "/notifications/read-all",
    summary: "Mark every notification read.",
    roles: ALL_ROLES,
    response: Ok,
  }),
  preferences: defineEndpoint({
    tag: "notifications",
    method: "GET",
    path: "/notifications/preferences",
    summary: "Which optional alerts the student receives.",
    roles: [Role.Student],
    response: NotificationPreferences,
  }),
  savePreferences: defineEndpoint({
    tag: "notifications",
    method: "PUT",
    path: "/notifications/preferences",
    summary: "Save the student's alert preferences.",
    roles: [Role.Student],
    body: NotificationPreferences,
    response: NotificationPreferences,
  }),
};

export const listNotifications = () => call(endpoints.list);
export const markAllRead = () => call(endpoints.readAll);
export const getPreferences = () => call(endpoints.preferences);
export const savePreferences = (body: NotificationPreferences) => call(endpoints.savePreferences, { body });
