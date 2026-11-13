import { callEndpoint, type RequestOptions } from "@/lib/api/client";
import { HttpMethod, defineEndpoint } from "@/lib/api/endpoint";
import { Role } from "@/lib/auth/roles";
import {
  auditLogSchema,
  auditQuerySchema,
  newStaffUserSchema,
  staffUserChangeSchema,
  staffUserParamsSchema,
  staffUserSchema,
  staffUsersQuerySchema,
  staffUsersSchema,
  type AuditLog,
  type AuditQuery,
  type NewStaffUser,
  type StaffUser,
  type StaffUserChange,
  type StaffUsers,
  type StaffUsersQuery,
} from "./schema";

const TAG = "system";
const SUPER_ADMIN = [Role.SuperAdmin];

export const listStaffUsersEndpoint = defineEndpoint({
  id: "admin.users.list",
  method: HttpMethod.Get,
  path: "/admin/users",
  summary:
    "Super admin: every office account (Transportation, Finance, Clinic, Student Affairs, " +
    "Secretary General, Abu El Hol, super admins) with its sign-in ID and whether it may " +
    "sign in. Filter by `role`, search `q` (ID or name). Students, guardians and crews come " +
    "from the university's records and the company's list, not from here.",
  tag: TAG,
  access: SUPER_ADMIN,
  query: staffUsersQuerySchema,
  response: staffUsersSchema,
});

export const createStaffUserEndpoint = defineEndpoint({
  id: "admin.users.create",
  method: HttpMethod.Post,
  path: "/admin/users",
  summary:
    "Super admin: add an office account. The server gives the next sign-in ID for the office " +
    "(FIN-1002…) and the person signs in with a code sent to `phone`. Logged in the audit log. " +
    "Errors: PHONE_TAKEN (409).",
  tag: TAG,
  access: SUPER_ADMIN,
  idempotent: true,
  body: newStaffUserSchema,
  response: staffUserSchema,
});

export const updateStaffUserEndpoint = defineEndpoint({
  id: "admin.users.update",
  method: HttpMethod.Patch,
  path: "/admin/users/{user_id}",
  summary:
    "Super admin: stop an account (`active: false`, its sessions end at once), let it sign in " +
    "again, or move it to another office (`role`). Logged in the audit log. Errors: " +
    "CANNOT_CHANGE_SELF (409), LAST_SUPER_ADMIN (409), USER_NOT_FOUND (404).",
  tag: TAG,
  access: SUPER_ADMIN,
  idempotent: true,
  params: staffUserParamsSchema,
  body: staffUserChangeSchema,
  response: staffUserSchema,
});

export const listAuditEndpoint = defineEndpoint({
  id: "admin.audit.list",
  method: HttpMethod.Get,
  path: "/admin/audit",
  summary:
    "Super admin: the activity log, newest first. One line per office decision (receipts, " +
    "requests, complaints, violations, announcements, SOS, replacements, event buses, " +
    "accounts): who, when, what about, and the note given. Filter by `area`, search `q`. " +
    "Read only: nobody can edit or delete a line.",
  tag: TAG,
  access: SUPER_ADMIN,
  query: auditQuerySchema,
  response: auditLogSchema,
});

export function listStaffUsers(
  query: StaffUsersQuery = {},
  options?: RequestOptions,
): Promise<StaffUsers> {
  return callEndpoint(listStaffUsersEndpoint, { query }, options);
}

export function createStaffUser(body: NewStaffUser, options?: RequestOptions): Promise<StaffUser> {
  return callEndpoint(createStaffUserEndpoint, { body }, options);
}

export function updateStaffUser(
  userId: string,
  body: StaffUserChange,
  options?: RequestOptions,
): Promise<StaffUser> {
  return callEndpoint(updateStaffUserEndpoint, { params: { user_id: userId }, body }, options);
}

export function listAudit(query: AuditQuery = {}, options?: RequestOptions): Promise<AuditLog> {
  return callEndpoint(listAuditEndpoint, { query }, options);
}

export const adminSystemEndpoints = [
  listStaffUsersEndpoint,
  createStaffUserEndpoint,
  updateStaffUserEndpoint,
  listAuditEndpoint,
];
