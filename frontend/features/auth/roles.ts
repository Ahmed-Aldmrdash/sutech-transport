/** Role values exactly as the server sends them in the token and in GET /me. */
export const Role = {
  SuperAdmin: "super_admin",
  TransportAdmin: "transport_admin",
  Finance: "finance",
  Clinic: "clinic",
  StudentAffairs: "student_affairs",
  SecretaryGeneral: "secretary_general",
  BusCompany: "bus_company",
  Driver: "driver",
  Supervisor: "supervisor",
  Student: "student",
  Parent: "parent",
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const ALL_ROLES = Object.values(Role) as Role[];

/** Roles that work inside the admin dashboard. */
export const ADMIN_ROLES: readonly Role[] = [
  Role.SuperAdmin,
  Role.TransportAdmin,
  Role.Finance,
  Role.Clinic,
  Role.StudentAffairs,
  Role.SecretaryGeneral,
  Role.BusCompany,
];

export const CREW_ROLES: readonly Role[] = [Role.Driver, Role.Supervisor];

export type AppArea = "student" | "parent" | "crew" | "admin";

export function areaOf(role: Role): AppArea {
  if (role === Role.Student) return "student";
  if (role === Role.Parent) return "parent";
  if (CREW_ROLES.includes(role)) return "crew";
  return "admin";
}

export const AREA_HOME: Record<AppArea, string> = {
  student: "/student",
  parent: "/parent",
  crew: "/driver",
  admin: "/admin",
};
