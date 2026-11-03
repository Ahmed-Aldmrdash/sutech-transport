import { Role } from "@/lib/auth/roles";
import { NotificationTarget, type NotificationLink } from "./schema";

type Paths = Partial<Record<NotificationTarget, string>>;

const STUDENT_PATHS: Paths = {
  [NotificationTarget.Home]: "/student",
  [NotificationTarget.Tracking]: "/student/tracking",
  [NotificationTarget.Payment]: "/student/payment",
  [NotificationTarget.Card]: "/student/card",
  [NotificationTarget.Request]: "/student/requests",
  [NotificationTarget.Complaint]: "/student/complaints",
  [NotificationTarget.Announcements]: "/student/announcements",
};

/** Guardians have no announcements page: those notifications only inform. */
const PARENT_PATHS: Paths = {
  [NotificationTarget.Home]: "/parent",
  [NotificationTarget.Tracking]: "/parent",
  [NotificationTarget.ChildDay]: "/parent/day",
  [NotificationTarget.Approvals]: "/parent/approvals",
};

/** Targets whose id is a query (which child) rather than a page of its own. */
const QUERY_ID_TARGETS: readonly NotificationTarget[] = [NotificationTarget.ChildDay];

/** The page a notification opens for this role, or null when it only informs. */
export function notificationHref(link: NotificationLink | null, role: Role): string | null {
  if (!link) return null;
  const paths = role === Role.Parent ? PARENT_PATHS : role === Role.Student ? STUDENT_PATHS : {};
  const base = paths[link.target];
  if (!base) return null;
  if (!link.id) return base;
  return QUERY_ID_TARGETS.includes(link.target)
    ? `${base}?child=${encodeURIComponent(link.id)}`
    : `${base}/${encodeURIComponent(link.id)}`;
}
