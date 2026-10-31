import { z } from "zod";
import { Id, IsoDateTime } from "@/lib/api/common";

export const Notification = z.object({
  id: Id,
  text: z.string(),
  created_at: IsoDateTime,
  read: z.boolean(),
  /** Set when the notification came from an announcement (deleting it removes this too). */
  announcement_id: Id.nullable(),
});
export type Notification = z.infer<typeof Notification>;

export const NotificationList = z.object({
  items: z.array(Notification),
  total: z.number().int(),
  unread: z.number().int().nonnegative(),
});

export const NotificationPreferences = z.object({
  bus_near_stop: z.boolean(),
  delays: z.boolean(),
  official: z.boolean(),
});
export type NotificationPreferences = z.infer<typeof NotificationPreferences>;
