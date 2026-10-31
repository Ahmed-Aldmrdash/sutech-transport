import { z } from "zod";
import { call } from "@/lib/api/client";
import { defineEndpoint } from "@/lib/api/endpoint";
import { Role } from "@/features/auth/roles";
import { NewViolation, Violation, ViolationDecision } from "./schema";

export const endpoints = {
  report: defineEndpoint({
    tag: "violations",
    method: "POST",
    path: "/violations",
    summary: "Report a violation with an optional photo.",
    roles: [Role.Driver, Role.Supervisor],
    body: NewViolation,
    response: Violation,
    idempotent: true,
  }),
  list: defineEndpoint({
    tag: "violations",
    method: "GET",
    path: "/admin/violations",
    summary: "All violations.",
    roles: [Role.SuperAdmin, Role.TransportAdmin, Role.StudentAffairs],
    response: z.array(Violation),
  }),
  decide: defineEndpoint({
    tag: "violations",
    method: "PATCH",
    path: "/admin/violations/{violation_id}",
    summary: "Refer to security and student affairs, or file without action.",
    roles: [Role.SuperAdmin, Role.TransportAdmin, Role.StudentAffairs],
    body: ViolationDecision,
    response: Violation,
  }),
};

export const reportViolation = (body: z.infer<typeof NewViolation>) => call(endpoints.report, { body });
export const listViolations = () => call(endpoints.list);
export const decideViolation = (id: string, status: "referred" | "dismissed") =>
  call(endpoints.decide, { params: { violation_id: id }, body: { status } });
