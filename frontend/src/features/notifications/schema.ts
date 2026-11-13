import { z } from "zod";
import { isoDateTime } from "@/lib/api/iso-datetime";

/** What a notification is about. Each kind has its own icon and where it leads. */
export const NotificationKind = {
  /** The bus is a few minutes from the student's stop (from the bus's GPS). */
  BusNear: "bus_near",
  BusDelayed: "bus_delayed",
  PaymentApproved: "payment_approved",
  PaymentRejected: "payment_rejected",
  /** The office moved or answered one of the student's requests. */
  RequestUpdate: "request_update",
  /** A new announcement from the Transportation office. */
  Announcement: "announcement",
  /** To guardians: their child's card was scanned on the bus. */
  ChildBoarded: "child_boarded",
  /** To guardians: the bus reached campus with their child on it. */
  ChildArrived: "child_arrived",
  /** To guardians: the bus reached campus without their child (no scan, no "not going"). */
  ChildAbsent: "child_absent",
  /** To guardians: the child said they won't ride on a day (today or a coming one). */
  ChildNotGoing: "child_not_going",
  /** To guardians: the child asked for a line change, which waits for the guardian's answer. */
  ApprovalNeeded: "approval_needed",
  /** To guardians: the child left the bus mid-trip; the body has the reason. */
  ChildCheckedOut: "child_checked_out",
  /**
   * To the student and their guardians: Student Affairs closed a bus conduct report about the
   * student with a warning or an investigation (not when it was dismissed).
   */
  ViolationDecision: "violation_decision",
} as const;
export type NotificationKind = (typeof NotificationKind)[keyof typeof NotificationKind];
const NOTIFICATION_KINDS = Object.values(NotificationKind) as [
  NotificationKind,
  ...NotificationKind[],
];

/**
 * Where tapping the notification goes. The server names the page, not a URL, so the app's
 * routes can change without touching the backend.
 */
export const NotificationTarget = {
  Home: "home",
  Tracking: "tracking",
  Payment: "payment",
  Card: "card",
  Request: "request",
  Complaint: "complaint",
  Announcements: "announcements",
  /** A guardian's "Today's trip" page; id is the student_id. */
  ChildDay: "child_day",
  /** A guardian's approvals page. */
  Approvals: "approvals",
} as const;
export type NotificationTarget = (typeof NotificationTarget)[keyof typeof NotificationTarget];

export const notificationLinkSchema = z.object({
  target: z.enum(
    Object.values(NotificationTarget) as [NotificationTarget, ...NotificationTarget[]],
  ),
  /** The request id for "request" and "complaint", the student_id for "child_day"; else null. */
  id: z.string().nullable(),
});
export type NotificationLink = z.infer<typeof notificationLinkSchema>;

export const notificationSchema = z.object({
  notification_id: z.string(),
  kind: z.enum(NOTIFICATION_KINDS),
  /** In the request's language. */
  title: z.string(),
  body: z.string(),
  created_at: isoDateTime(),
  /** null while unread. */
  read_at: isoDateTime().nullable(),
  link: notificationLinkSchema.nullable(),
});
export type AppNotification = z.infer<typeof notificationSchema>;

const NOTIFICATIONS_MAX_PAGE_SIZE = 50;

export const listNotificationsQuerySchema = z.object({
  page: z.number().int().positive().optional(),
  page_size: z.number().int().positive().max(NOTIFICATIONS_MAX_PAGE_SIZE).optional(),
  unread_only: z.boolean().optional(),
});

export const notificationPageSchema = z.object({
  items: z.array(notificationSchema),
  total: z.number().int().nonnegative(),
  /** Across all pages: drives the badge on the bell. */
  unread_count: z.number().int().nonnegative(),
});
export type NotificationPage = z.infer<typeof notificationPageSchema>;

export const notificationParamsSchema = z.object({ notification_id: z.string().min(1) });

export const unreadCountSchema = z.object({ unread_count: z.number().int().nonnegative() });
export type UnreadCount = z.infer<typeof unreadCountSchema>;
