import { NotificationTarget, type NotificationLink } from "./schema";

const STUDENT_PATHS: Record<NotificationTarget, string> = {
  [NotificationTarget.Home]: "/student",
  [NotificationTarget.Tracking]: "/student/tracking",
  [NotificationTarget.Payment]: "/student/payment",
  [NotificationTarget.Card]: "/student/card",
  [NotificationTarget.Request]: "/student/requests",
  [NotificationTarget.Complaint]: "/student/complaints",
  [NotificationTarget.Announcements]: "/student/announcements",
};

/** The student page a notification opens, or null when it only informs. */
export function notificationHref(link: NotificationLink | null): string | null {
  if (!link) return null;
  const base = STUDENT_PATHS[link.target];
  return link.id ? `${base}/${encodeURIComponent(link.id)}` : base;
}
