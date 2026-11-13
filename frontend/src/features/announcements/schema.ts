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

export const ANNOUNCEMENT_TITLE_MIN_LENGTH = 5;
export const ANNOUNCEMENT_TITLE_MAX_LENGTH = 120;
export const ANNOUNCEMENT_BODY_MIN_LENGTH = 10;
export const ANNOUNCEMENT_BODY_MAX_LENGTH = 1000;

/** What the office posts by hand. Delays come from the crews' delay reports. */
export const OFFICE_ANNOUNCEMENT_KINDS = [
  AnnouncementKind.Official,
  AnnouncementKind.ServiceChange,
] as const;

const titleSchema = z
  .string()
  .trim()
  .min(ANNOUNCEMENT_TITLE_MIN_LENGTH)
  .max(ANNOUNCEMENT_TITLE_MAX_LENGTH);
const bodySchema = z
  .string()
  .trim()
  .min(ANNOUNCEMENT_BODY_MIN_LENGTH)
  .max(ANNOUNCEMENT_BODY_MAX_LENGTH);

/**
 * An announcement from the Transportation office, written in both languages so every reader
 * gets their own. `line_id` null: for every student and guardian.
 */
export const createAnnouncementBodySchema = z.object({
  kind: z.enum(OFFICE_ANNOUNCEMENT_KINDS),
  line_id: z.string().min(1).nullable(),
  title_ar: titleSchema,
  title_en: titleSchema,
  body_ar: bodySchema,
  body_en: bodySchema,
});
export type CreateAnnouncementBody = z.infer<typeof createAnnouncementBodySchema>;
