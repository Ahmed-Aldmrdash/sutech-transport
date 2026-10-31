import { z } from "zod";
import { Id, IsoDateTime } from "@/lib/api/common";

export const AnnouncementKind = {
  Official: "official",
  Delay: "delay",
  BusChange: "bus_change",
  TimeChange: "time_change",
  BackOnSchedule: "back_on_schedule",
  TripCancelled: "trip_cancelled",
  ExtraDeparture: "extra_departure",
} as const;
export type AnnouncementKind = (typeof AnnouncementKind)[keyof typeof AnnouncementKind];
const KINDS = Object.values(AnnouncementKind) as [AnnouncementKind, ...AnnouncementKind[]];

/** Kinds the transport office sends by hand from the delays page. */
export const LINE_ALERT_KINDS = [
  AnnouncementKind.Delay,
  AnnouncementKind.BusChange,
  AnnouncementKind.TimeChange,
  AnnouncementKind.TripCancelled,
] as const;

export const ALL_LINES = "all";

export const Announcement = z.object({
  id: Id,
  kind: z.enum(KINDS),
  title: z.string().nullable(),
  text: z.string(),
  /** "all" or a line id. */
  target: z.string(),
  target_name: z.string(),
  delay_minutes: z.number().int().positive().nullable(),
  pinned: z.boolean(),
  to_parents: z.boolean(),
  published_at: IsoDateTime,
  author: z.string(),
  /** A delay that is over (the bus is back on schedule) stays in the history marked as ended. */
  ended: z.boolean(),
});
export type Announcement = z.infer<typeof Announcement>;

export const ScheduledAnnouncement = z.object({
  id: Id,
  title: z.string(),
  text: z.string(),
  target: z.string(),
  target_name: z.string(),
  publish_at: IsoDateTime,
  pinned: z.boolean(),
  to_parents: z.boolean(),
  author: z.string(),
  /** Created by the term setup; publishes itself on the booking-open day. */
  is_term_opening: z.boolean(),
});
export type ScheduledAnnouncement = z.infer<typeof ScheduledAnnouncement>;

export const AnnouncementList = z.object({ items: z.array(Announcement), total: z.number().int() });

export const AdminAnnouncements = z.object({
  published: z.array(Announcement),
  scheduled: z.array(ScheduledAnnouncement),
});

export const ActiveDelay = z.object({
  line_id: Id,
  line_name: z.string(),
  minutes: z.number().int().positive(),
  reason: z.string(),
  announcement_id: Id,
});
export type ActiveDelay = z.infer<typeof ActiveDelay>;

export const NewAnnouncement = z.object({
  kind: z.enum(KINDS),
  title: z.string().trim().min(3).max(120).nullable(),
  text: z.string().trim().min(5).max(1000),
  target: z.string().min(1),
  delay_minutes: z.number().int().min(1).max(180).nullable(),
  pinned: z.boolean(),
  to_parents: z.boolean(),
  /** Leave null to publish now. */
  publish_at: IsoDateTime.nullable(),
});
export type NewAnnouncement = z.infer<typeof NewAnnouncement>;

export const PinUpdate = z.object({ pinned: z.boolean() });
