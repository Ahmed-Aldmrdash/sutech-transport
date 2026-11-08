import { z } from "zod";
import { lineSummarySchema } from "@/features/lines/schema";

export const AnnouncementKind = {
  /** From the Transportation office to everyone, e.g. "Booking is open". */
  Official: "official",
  /** A late bus on one line. */
  Delay: "delay",
  /** A change to a line, a stop or a time. */
  ServiceChange: "service_change",
} as const;
export type AnnouncementKind = (typeof AnnouncementKind)[keyof typeof AnnouncementKind];

export const announcementSchema = z.object({
  announcement_id: z.string(),
  kind: z.enum([AnnouncementKind.Official, AnnouncementKind.Delay, AnnouncementKind.ServiceChange]),
  title: z.string(),
  body: z.string(),
  /** null when it is for everyone. */
  line: lineSummarySchema.nullable(),
  published_at: z.iso.datetime(),
});
export type Announcement = z.infer<typeof announcementSchema>;

const ANNOUNCEMENTS_MAX_PAGE_SIZE = 50;

export const ANNOUNCEMENT_KINDS = [
  AnnouncementKind.Official,
  AnnouncementKind.Delay,
  AnnouncementKind.ServiceChange,
] as const;

export const listAnnouncementsQuerySchema = z.object({
  kind: z.enum(ANNOUNCEMENT_KINDS).optional(),
  page: z.number().int().positive().optional(),
  page_size: z.number().int().positive().max(ANNOUNCEMENTS_MAX_PAGE_SIZE).optional(),
});

export const announcementPageSchema = z.object({
  items: z.array(announcementSchema),
  total: z.number().int().nonnegative(),
});
export type AnnouncementPage = z.infer<typeof announcementPageSchema>;
