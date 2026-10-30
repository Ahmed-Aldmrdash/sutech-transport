import { z } from "zod";
import { call } from "@/lib/api/client";
import { defineEndpoint } from "@/lib/api/endpoint";
import { Role } from "@/features/auth/roles";
import { AdminUser, AuditPage, NewUser, Overview, UserUpdate } from "./schema";

export const endpoints = {
  overview: defineEndpoint({
    tag: "admin",
    method: "GET",
    path: "/admin/overview",
    summary: "Dashboard numbers, line occupancy and the activity feed.",
    roles: [Role.SuperAdmin, Role.TransportAdmin, Role.SecretaryGeneral],
    response: Overview,
  }),
  audit: defineEndpoint({
    tag: "admin",
    method: "GET",
    path: "/admin/audit",
    summary: "Audit log: who did what and when (query: page, page_size).",
    roles: [Role.SuperAdmin],
    response: AuditPage,
  }),
  users: defineEndpoint({
    tag: "admin",
    method: "GET",
    path: "/admin/users",
    summary: "Staff accounts and their roles.",
    roles: [Role.SuperAdmin],
    response: z.array(AdminUser),
  }),
  createUser: defineEndpoint({
    tag: "admin",
    method: "POST",
    path: "/admin/users",
    summary: "Create a staff account with one role.",
    roles: [Role.SuperAdmin],
    body: NewUser,
    response: AdminUser,
    idempotent: true,
  }),
  updateUser: defineEndpoint({
    tag: "admin",
    method: "PATCH",
    path: "/admin/users/{user_id}",
    summary: "Change a role or turn an account off. The last active super admin can't be turned off.",
    roles: [Role.SuperAdmin],
    body: UserUpdate,
    response: AdminUser,
  }),
};

export const getOverview = () => call(endpoints.overview);
export const getAudit = (page = 1, pageSize = 50) => call(endpoints.audit, { query: { page, page_size: pageSize } });
export const listUsers = () => call(endpoints.users);
export const createUser = (name: string, role: string) => call(endpoints.createUser, { body: { name, role } });
export const updateUser = (id: string, update: z.infer<typeof UserUpdate>) =>
  call(endpoints.updateUser, { params: { user_id: id }, body: update });
