import {
  Armchair,
  BadgeAlert,
  Bell,
  Building2,
  Bus,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  CreditCard,
  FileBarChart,
  FileClock,
  HeartPulse,
  House,
  IdCard,
  Landmark,
  LayoutDashboard,
  ListChecks,
  MapPinned,
  Megaphone,
  MessageCircleQuestion,
  MessageSquareWarning,
  Receipt,
  Route,
  ScanLine,
  Settings,
  ShieldAlert,
  Siren,
  Timer,
  UserCheck,
  Users,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Role } from "@/lib/auth/roles";

/** Keys under `nav.items` in the translation files. */
export type NavItemKey =
  | "home"
  | "lines"
  | "lineDirectory"
  | "payment"
  | "card"
  | "tracking"
  | "announcements"
  | "notifications"
  | "notGoingToday"
  | "attendanceHistory"
  | "requests"
  | "complaints"
  | "assistant"
  | "settings"
  | "childDay"
  | "approvals"
  | "trip"
  | "scan"
  | "passengers"
  | "reportDelay"
  | "sos"
  | "violations"
  | "overview"
  | "liveTracking"
  | "emergencies"
  | "attendance"
  | "busesDrivers"
  | "students"
  | "departures"
  | "payments"
  | "refunds"
  | "reports"
  | "auditLog"
  | "clinic"
  | "secretaryGeneral"
  | "events"
  | "busCompany"
  | "users";

/** Keys under `nav.groups`. */
type NavGroupKey =
  "main" | "account" | "operations" | "finance" | "followUp" | "otherParties" | "system";

export interface NavItem {
  key: NavItemKey;
  icon: LucideIcon;
  /** Path under the role's base path; "" is the role's home. */
  segment: string;
  /** Shown in the phone's bottom bar (at most four per role, the rest go in the menu). */
  primary?: boolean;
  /**
   * Planned but not built yet: listed in the menu as "coming soon". Its link opens a "being
   * built" page for the offices that own it (see findSoonItem). Removed the day it ships.
   */
  soon?: boolean;
}

/** A number to show on a menu item (unread notifications). 0 or missing shows nothing. */
export type NavBadges = Partial<Record<NavItemKey, number>>;

/**
 * The message (under `nav`) for a badged link's one accessible name: "Notifications 2 new" or
 * "Approvals 1 waiting for you" (starting with the visible text, for voice control). The visible number is decorative, so it is heard once.
 */
export function badgeLabelKey(key: NavItemKey): "withWaiting" | "withBadge" {
  return key === "approvals" ? "withWaiting" : "withBadge";
}

export interface NavGroup {
  key: NavGroupKey;
  items: readonly NavItem[];
}

export interface RoleNavigation {
  /** Where this role's pages live, e.g. "/student". */
  basePath: `/${string}`;
  groups: readonly NavGroup[];
  /** The page the role lands on after sign-in, when it isn't the first one in the menu. */
  landing?: NavItemKey;
}

export const MAX_PRIMARY_ITEMS = 4;

const STUDENT_NAV: RoleNavigation = {
  basePath: "/student",
  groups: [
    {
      key: "main",
      items: [
        { key: "home", icon: House, segment: "", primary: true },
        { key: "lines", icon: Route, segment: "lines", primary: true },
        { key: "card", icon: IdCard, segment: "card", primary: true },
        { key: "payment", icon: Wallet, segment: "payment" },
        { key: "tracking", icon: MapPinned, segment: "tracking" },
        { key: "notifications", icon: Bell, segment: "notifications", primary: true },
        { key: "announcements", icon: Megaphone, segment: "announcements" },
        { key: "notGoingToday", icon: CalendarDays, segment: "not-going-today" },
        { key: "attendanceHistory", icon: CalendarCheck, segment: "attendance" },
      ],
    },
    {
      key: "account",
      items: [
        { key: "requests", icon: ClipboardList, segment: "requests" },
        { key: "complaints", icon: MessageSquareWarning, segment: "complaints" },
        // The AI team's assistant: not part of the front end phases yet.
        { key: "assistant", icon: MessageCircleQuestion, segment: "assistant", soon: true },
        { key: "settings", icon: Settings, segment: "settings" },
      ],
    },
  ],
};

const PARENT_NAV: RoleNavigation = {
  basePath: "/parent",
  groups: [
    {
      key: "main",
      items: [
        { key: "home", icon: House, segment: "", primary: true },
        { key: "childDay", icon: CalendarCheck, segment: "day", primary: true },
        { key: "notifications", icon: Bell, segment: "notifications", primary: true },
        { key: "approvals", icon: ListChecks, segment: "approvals", primary: true },
      ],
    },
    { key: "account", items: [{ key: "settings", icon: Settings, segment: "settings" }] },
  ],
};

const CREW_NAV: RoleNavigation = {
  basePath: "/driver",
  groups: [
    {
      key: "main",
      items: [
        { key: "trip", icon: Bus, segment: "", primary: true },
        { key: "scan", icon: ScanLine, segment: "scan", primary: true },
        { key: "passengers", icon: Users, segment: "passengers", primary: true },
        { key: "sos", icon: Siren, segment: "sos", primary: true },
        { key: "reportDelay", icon: Timer, segment: "delay" },
        { key: "violations", icon: BadgeAlert, segment: "violations" },
      ],
    },
  ],
};

interface OfficeNavItem extends NavItem {
  /** Office roles that may open this page. Super admin always may. */
  roles: readonly Role[];
}

interface OfficeNavGroup {
  key: NavGroupKey;
  items: readonly OfficeNavItem[];
}

const { Transport, Finance, Clinic, StudentAffairs, SecretaryGeneral, BusCompany } = Role;

/** Office pages that are built. Every other office page shows as "coming soon". */
const READY_OFFICE_PAGES: ReadonlySet<NavItemKey> = new Set([
  "users",
  "auditLog",
  "overview",
  "liveTracking",
  "attendance",
  "lineDirectory",
  "busesDrivers",
  "students",
  "emergencies",
  "clinic",
  "announcements",
  "payments",
  "refunds",
  "requests",
  "complaints",
  "violations",
  "reports",
  "secretaryGeneral",
  "events",
  "busCompany",
]);

/** Offices whose own page isn't the first in their menu: they land on it after sign-in. */
const OFFICE_LANDING: Partial<Record<Role, NavItemKey>> = {
  [SecretaryGeneral]: "secretaryGeneral",
};

/** For an office with no built page yet: its home, which lists what is coming. */
const OFFICE_WELCOME: NavItem = { key: "home", icon: House, segment: "", primary: true };

/** The 21 office pages from the agreed plan, each with the offices that own it. */
const OFFICE_GROUPS: readonly OfficeNavGroup[] = [
  {
    key: "operations",
    items: [
      { key: "overview", icon: LayoutDashboard, segment: "", roles: [Transport], primary: true },
      {
        key: "liveTracking",
        icon: MapPinned,
        segment: "tracking",
        roles: [Transport],
        primary: true,
      },
      {
        key: "emergencies",
        icon: Siren,
        segment: "emergencies",
        roles: [Transport, Clinic],
        primary: true,
      },
      { key: "attendance", icon: UserCheck, segment: "attendance", roles: [Transport] },
      { key: "announcements", icon: Megaphone, segment: "announcements", roles: [Transport] },
      { key: "lineDirectory", icon: Route, segment: "lines", roles: [Transport] },
      { key: "busesDrivers", icon: Bus, segment: "buses", roles: [Transport] },
      { key: "students", icon: UsersRound, segment: "students", roles: [Transport] },
      { key: "departures", icon: Armchair, segment: "departures", roles: [Transport] },
    ],
  },
  {
    key: "finance",
    items: [
      { key: "payments", icon: CreditCard, segment: "payments", roles: [Finance], primary: true },
      { key: "refunds", icon: Receipt, segment: "refunds", roles: [Finance], primary: true },
    ],
  },
  {
    key: "followUp",
    items: [
      {
        key: "violations",
        icon: ShieldAlert,
        segment: "violations",
        roles: [Transport, StudentAffairs],
        primary: true,
      },
      { key: "requests", icon: ClipboardList, segment: "requests", roles: [Transport] },
      {
        key: "complaints",
        icon: MessageSquareWarning,
        segment: "complaints",
        roles: [Transport, Finance],
      },
      {
        key: "reports",
        icon: FileBarChart,
        segment: "reports",
        roles: [Transport, Finance, SecretaryGeneral],
        primary: true,
      },
      { key: "auditLog", icon: FileClock, segment: "audit-log", roles: [] },
    ],
  },
  {
    key: "otherParties",
    items: [
      { key: "clinic", icon: HeartPulse, segment: "clinic", roles: [Clinic], primary: true },
      {
        key: "secretaryGeneral",
        icon: Landmark,
        segment: "secretary-general",
        roles: [SecretaryGeneral],
        primary: true,
      },
      { key: "events", icon: CalendarDays, segment: "events", roles: [Transport] },
      {
        key: "busCompany",
        icon: Building2,
        segment: "bus-company",
        roles: [BusCompany],
        primary: true,
      },
    ],
  },
  {
    key: "system",
    items: [{ key: "users", icon: Users, segment: "users", roles: [] }],
  },
];

function toNavItem({ key, icon, segment, primary }: OfficeNavItem): NavItem {
  return READY_OFFICE_PAGES.has(key)
    ? { key, icon, segment, primary }
    : { key, icon, segment, soon: true };
}

function officeNavigationFor(role: Role): RoleNavigation {
  const canSee = (item: OfficeNavItem) => role === Role.SuperAdmin || item.roles.includes(role);
  const groups: NavGroup[] = OFFICE_GROUPS.map((group) => ({
    key: group.key,
    items: group.items.filter(canSee).map(toNavItem),
  })).filter((group) => group.items.length > 0);
  const navigation: RoleNavigation = { basePath: "/admin", groups, landing: OFFICE_LANDING[role] };
  if (readyItems(navigation).length > 0) return navigation;
  return { basePath: "/admin", groups: [{ key: "main", items: [OFFICE_WELCOME] }, ...groups] };
}

/** The pages a role can open today (everything but "coming soon"). */
export function readyItems(navigation: RoleNavigation): NavItem[] {
  return navigation.groups.flatMap((group) => group.items).filter((item) => !item.soon);
}

/**
 * The planned page at this path, if the role owns one there: it opens as "being built".
 * Office homes ("") are left out: those paths belong to the office's welcome page.
 */
export function findSoonItem(navigation: RoleNavigation, pathname: string): NavItem | undefined {
  return soonItems(navigation).find(
    (item) => item.segment !== "" && itemHref(navigation.basePath, item) === pathname,
  );
}

/** The planned pages a role will get, shown as "coming soon". */
export function soonItems(navigation: RoleNavigation): NavItem[] {
  return navigation.groups.flatMap((group) => group.items).filter((item) => item.soon);
}

/** The menu each role sees. Strict separation: a role never sees another role's pages. */
export function navigationFor(role: Role): RoleNavigation {
  switch (role) {
    case Role.Student:
      return STUDENT_NAV;
    case Role.Parent:
      return PARENT_NAV;
    case Role.Driver:
    case Role.Supervisor:
      return CREW_NAV;
    default:
      return officeNavigationFor(role);
  }
}

/** Items for the phone's bottom bar: the role's primary items, capped. */
export function primaryItems(navigation: RoleNavigation): NavItem[] {
  return readyItems(navigation)
    .filter((item) => item.primary)
    .slice(0, MAX_PRIMARY_ITEMS);
}

export function itemHref(basePath: string, item: NavItem): string {
  return item.segment ? `${basePath}/${item.segment}` : basePath;
}

/** Longest-prefix match so "/admin" is not active on "/admin/payments". Built pages only. */
export function findActiveItem(
  navigation: RoleNavigation,
  basePath: string,
  pathname: string,
): NavItem | undefined {
  const items = readyItems(navigation);
  let best: NavItem | undefined;
  let bestLength = -1;
  for (const item of items) {
    const href = itemHref(basePath, item);
    const matches = pathname === href || (item.segment !== "" && pathname.startsWith(`${href}/`));
    if (matches && href.length > bestLength) {
      best = item;
      bestLength = href.length;
    }
  }
  return best;
}

/**
 * Where a role lands after sign-in: its landing page if it has one, else its "" page, else
 * its first built page.
 */
export function roleHomeHref(navigation: RoleNavigation): string {
  const items = readyItems(navigation);
  const home =
    items.find((item) => item.key === navigation.landing) ??
    items.find((item) => item.segment === "") ??
    items[0];
  return home ? itemHref(navigation.basePath, home) : navigation.basePath;
}
