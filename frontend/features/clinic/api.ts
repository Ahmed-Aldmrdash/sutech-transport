import { z } from "zod";
import { call } from "@/lib/api/client";
import { defineEndpoint } from "@/lib/api/endpoint";
import { Role } from "@/features/auth/roles";
import { NewPermit, Permit } from "./schema";

const CLINIC = [Role.SuperAdmin, Role.Clinic] as const;

export const endpoints = {
  list: defineEndpoint({
    tag: "clinic",
    method: "GET",
    path: "/admin/clinic/permits",
    summary: "Clinic permits (priority seat, medical leave, escort).",
    roles: CLINIC,
    response: z.array(Permit),
  }),
  create: defineEndpoint({
    tag: "clinic",
    method: "POST",
    path: "/admin/clinic/permits",
    summary: "Issue a permit; the transport office and the driver see it, the student is notified.",
    roles: CLINIC,
    body: NewPermit,
    response: Permit,
    idempotent: true,
  }),
  revoke: defineEndpoint({
    tag: "clinic",
    method: "POST",
    path: "/admin/clinic/permits/{permit_id}/revoke",
    summary: "Revoke a permit.",
    roles: CLINIC,
    response: Permit,
  }),
};

export const listPermits = () => call(endpoints.list);
export const issuePermit = (body: z.infer<typeof NewPermit>) => call(endpoints.create, { body });
export const revokePermit = (id: string) => call(endpoints.revoke, { params: { permit_id: id } });
