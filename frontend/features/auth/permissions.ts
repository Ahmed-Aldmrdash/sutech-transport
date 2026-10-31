import { Role } from "./roles";

/** Every admin dashboard page. The key is also the URL segment under /admin. */
export const AdminPage = {
  Overview: "overview",
  Live: "live",
  Sos: "sos",
  Attendance: "attendance",
  Announcements: "announcements",
  Lines: "lines",
  Buses: "buses",
  Students: "students",
  Departures: "departures",
  Term: "term",
  Payments: "payments",
  Requests: "requests",
  Violations: "violations",
  Complaints: "complaints",
  Reports: "reports",
  Audit: "audit",
  Clinic: "clinic",
  SecretaryGeneral: "secretary-general",
  Events: "events",
  BusCompany: "bus-company",
  Users: "users",
} as const;

export type AdminPage = (typeof AdminPage)[keyof typeof AdminPage];

export const ALL_ADMIN_PAGES = Object.values(AdminPage) as AdminPage[];

/** Strict role separation (plan: roles & permissions). Super admin sees everything. */
const PAGES_BY_ROLE: Partial<Record<Role, readonly AdminPage[]>> = {
  [Role.SuperAdmin]: ALL_ADMIN_PAGES,
  [Role.TransportAdmin]: [
    AdminPage.Overview,
    AdminPage.Live,
    AdminPage.Sos,
    AdminPage.Attendance,
    AdminPage.Announcements,
    AdminPage.Lines,
    AdminPage.Buses,
    AdminPage.Students,
    AdminPage.Departures,
    AdminPage.Term,
    AdminPage.Requests,
    AdminPage.Violations,
    AdminPage.Complaints,
    AdminPage.Reports,
    AdminPage.Events,
  ],
  [Role.Finance]: [AdminPage.Payments, AdminPage.Requests, AdminPage.Reports],
  [Role.Clinic]: [AdminPage.Clinic, AdminPage.Sos],
  [Role.StudentAffairs]: [AdminPage.Violations],
  [Role.SecretaryGeneral]: [AdminPage.SecretaryGeneral, AdminPage.Reports],
  [Role.BusCompany]: [AdminPage.BusCompany],
};

export function pagesFor(role: Role): readonly AdminPage[] {
  return PAGES_BY_ROLE[role] ?? [];
}

export function canSeePage(role: Role, page: AdminPage): boolean {
  return pagesFor(role).includes(page);
}

export function firstPageFor(role: Role): AdminPage | undefined {
  return pagesFor(role)[0];
}

/** Read-only roles may open a page but never change anything on it. */
export function isReadOnly(role: Role): boolean {
  return role === Role.SecretaryGeneral;
}
