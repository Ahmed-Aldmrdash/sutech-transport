/**
 * Every account has exactly one role. The front end only hides what a role may not see;
 * the FastAPI server is the real guard and must reject any request outside the caller's role.
 */
export const Role = {
  SuperAdmin: "super_admin",
  Transport: "transport_admin",
  Finance: "finance",
  Clinic: "clinic",
  StudentAffairs: "student_affairs",
  SecretaryGeneral: "secretary_general",
  BusCompany: "bus_company",
  Driver: "driver",
  Supervisor: "supervisor",
  Student: "student",
  /** University staff and faculty: they ride for free and have no guardian. */
  Employee: "employee",
  Parent: "parent",
} as const;
export type Role = (typeof Role)[keyof typeof Role];

/** The accounts that ride the buses with a seat of their own. */
const RIDER_ROLES: readonly Role[] = [Role.Student, Role.Employee];

export function isRiderRole(role: Role): boolean {
  return RIDER_ROLES.includes(role);
}

export const ALL_ROLES: readonly Role[] = Object.values(Role);

export function isRole(value: unknown): value is Role {
  return ALL_ROLES.includes(value as Role);
}
