import { callEndpoint, type RequestOptions } from "@/lib/api/client";
import { HttpMethod, defineEndpoint } from "@/lib/api/endpoint";
import { ALL_ROLES } from "@/lib/auth/roles";
import {
  listNotificationsQuerySchema,
  notificationPageSchema,
  notificationParamsSchema,
  unreadCountSchema,
  type NotificationPage,
  type UnreadCount,
} from "./schema";

const TAG = "notifications";

export const listNotificationsEndpoint = defineEndpoint({
  id: "notifications.list",
  method: HttpMethod.Get,
  path: "/notifications",
  summary:
    "The caller's notifications, newest first, with the unread count. New ones also arrive live " +
    "as the `notification.new` event; the app re-reads this list when one comes in. Text " +
    "follows Accept-Language.",
  tag: TAG,
  access: ALL_ROLES,
  query: listNotificationsQuerySchema,
  response: notificationPageSchema,
});

export const markNotificationReadEndpoint = defineEndpoint({
  id: "notifications.markRead",
  method: HttpMethod.Post,
  path: "/notifications/{notification_id}/read",
  summary: "Marks one notification read (already read: no change). Returns the new unread count.",
  tag: TAG,
  access: ALL_ROLES,
  params: notificationParamsSchema,
  response: unreadCountSchema,
});

export const markAllNotificationsReadEndpoint = defineEndpoint({
  id: "notifications.markAllRead",
  method: HttpMethod.Post,
  path: "/notifications/read-all",
  summary: "Marks every notification read. Returns the new unread count (0).",
  tag: TAG,
  access: ALL_ROLES,
  response: unreadCountSchema,
});

export function listNotifications(
  query: { page?: number; page_size?: number; unread_only?: boolean } = {},
  options?: RequestOptions,
): Promise<NotificationPage> {
  return callEndpoint(listNotificationsEndpoint, { query }, options);
}

export function markNotificationRead(
  notificationId: string,
  options?: RequestOptions,
): Promise<UnreadCount> {
  return callEndpoint(
    markNotificationReadEndpoint,
    { params: { notification_id: notificationId } },
    options,
  );
}

export function markAllNotificationsRead(options?: RequestOptions): Promise<UnreadCount> {
  return callEndpoint(markAllNotificationsReadEndpoint, {}, options);
}

export const notificationsEndpoints = [
  listNotificationsEndpoint,
  markAllNotificationsReadEndpoint,
  markNotificationReadEndpoint,
];
