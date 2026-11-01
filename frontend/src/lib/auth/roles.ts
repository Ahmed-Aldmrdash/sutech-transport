/**
 * Every account has exactly one role. The front end only hides what a role may not see;
 * the FastAPI server is the real guard and must reject any request outside the caller's role.
 */
export const Role = {
  SuperAdmin: "super_admin",
  Transport: "transport",
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

export const ALL_ROLES: readonly Role[] = Object.values(Role);

/** Office staff work mostly on a laptop; the rest mostly on a phone. Both layouts work for all. */
export const OFFICE_ROLES: readonly Role[] = [
  Role.SuperAdmin,
  Role.Transport,
  Role.Finance,
  Role.Clinic,
  Role.StudentAffairs,
  Role.SecretaryGeneral,
  Role.BusCompany,
];

export function isRole(value: unknown): value is Role {
  return ALL_ROLES.includes(value as Role);
}
