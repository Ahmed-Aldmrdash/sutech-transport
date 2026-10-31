import { z } from "zod";
import { Id, IsoDate, IsoDateTime, Money } from "@/lib/api/common";

export const RequestType = {
  Refund: "refund",
  LineChange: "line_change",
  ProjectModel: "project_model",
  GuardianChange: "guardian_change",
} as const;
export type RequestType = (typeof RequestType)[keyof typeof RequestType];

export const StepActor = { Parent: "parent", Transport: "transport", Finance: "finance" } as const;
export type StepActor = (typeof StepActor)[keyof typeof StepActor];

export const StepState = { Done: "done", Current: "current", Waiting: "waiting", Rejected: "rejected" } as const;

export const RequestStep = z.object({
  actor: z.enum(["parent", "transport", "finance"]),
  state: z.enum(["done", "current", "waiting", "rejected"]),
  at: IsoDateTime.nullable(),
});
export type RequestStep = z.infer<typeof RequestStep>;

const RefundDetails = z.object({
  type: z.literal("refund"),
  paid: Money,
  week: z.number().int().nonnegative(),
  deduction_percent: z.number().int().min(0).max(100),
  refund_amount: Money,
});
const LineChangeDetails = z.object({
  type: z.literal("line_change"),
  to_line_id: Id,
  to_line_name: z.string(),
  kind: z.enum(["temporary", "permanent"]),
  until: IsoDate.nullable(),
});
const ProjectModelDetails = z.object({
  type: z.literal("project_model"),
  date: IsoDate,
  size: z.string(),
});
const GuardianChangeDetails = z.object({
  type: z.literal("guardian_change"),
  field: z.enum(["phone", "name", "both"]),
});

export const RequestDetails = z.discriminatedUnion("type", [
  RefundDetails,
  LineChangeDetails,
  ProjectModelDetails,
  GuardianChangeDetails,
]);

export const StudentRequest = z.object({
  id: Id,
  student_id: z.string(),
  student_name: z.string(),
  created_at: IsoDateTime,
  status: z.enum(["open", "approved", "rejected"]),
  reason: z.string(),
  details: RequestDetails,
  steps: z.array(RequestStep),
  rejection_reason: z.string().nullable(),
});
export type StudentRequest = z.infer<typeof StudentRequest>;

export const RequestList = z.object({ items: z.array(StudentRequest), total: z.number().int() });

export const NewRequest = z.discriminatedUnion("type", [
  z.object({ type: z.literal("refund"), reason: z.string().trim().min(3).max(500) }),
  z.object({
    type: z.literal("line_change"),
    reason: z.string().trim().min(3).max(500),
    to_line_id: Id,
    kind: z.enum(["temporary", "permanent"]),
    until: IsoDate.nullable(),
  }),
  z.object({
    type: z.literal("project_model"),
    reason: z.string().trim().min(3).max(500),
    date: IsoDate,
    size: z.string().trim().min(2).max(60),
  }),
  z.object({
    type: z.literal("guardian_change"),
    reason: z.string().trim().min(3).max(500),
    field: z.enum(["phone", "name", "both"]),
  }),
]);
export type NewRequest = z.infer<typeof NewRequest>;

export const Decision = z.object({
  approve: z.boolean(),
  reason: z.string().trim().max(300).nullable(),
});

export const OPEN = "open";
export function isOpen(request: Pick<StudentRequest, "status">) {
  return request.status === OPEN;
}
