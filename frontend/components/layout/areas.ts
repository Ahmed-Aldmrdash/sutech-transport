import { Bus, ClipboardCheck, FileWarning, House, LayoutGrid, MapPin, Megaphone, QrCode, ScanLine, Users } from "lucide-react";
import type { NavItem } from "./nav";

export const STUDENT_NAV: NavItem[] = [
  { href: "/student", label: "home", icon: House, exact: true },
  { href: "/student/lines", label: "lines", icon: Bus },
  { href: "/student/card", label: "card", icon: QrCode },
  { href: "/student/tracking", label: "tracking", icon: MapPin },
  { href: "/student/more", label: "more", icon: LayoutGrid },
];

export const PARENT_NAV: NavItem[] = [
  { href: "/parent", label: "children", icon: Users, exact: true },
  { href: "/parent/tracking", label: "tracking", icon: MapPin },
  { href: "/parent/approvals", label: "approvals", icon: ClipboardCheck },
  { href: "/parent/announcements", label: "announcements", icon: Megaphone },
];

export const CREW_NAV: NavItem[] = [
  { href: "/driver", label: "trip", icon: Bus, exact: true },
  { href: "/driver/scan", label: "scan", icon: ScanLine },
  { href: "/driver/report", label: "report", icon: FileWarning },
  { href: "/driver/announcements", label: "announcements", icon: Megaphone },
];
