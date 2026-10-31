import { z } from "zod";
import { Id, IsoDate } from "@/lib/api/common";
import { Subscription } from "@/features/subscriptions/schema";

export const AdminStudent = z.object({
  id: z.string(),
  name: z.string(),
  faculty: z.string(),
  level: z.string(),
  status: Subscription.shape.status,
  line_id: Id.nullable(),
  line_name: z.string().nullable(),
  stop_name: z.string().nullable(),
  assignment: Subscription.shape.assignment,
});
export type AdminStudent = z.infer<typeof AdminStudent>;

export const StudentList = z.object({ items: z.array(AdminStudent), total: z.number().int() });

export const Transfer = z.object({
  to_line_id: Id,
  kind: z.enum(["today", "temporary", "permanent"]),
  until: IsoDate.nullable(),
});
export const CancelSubscription = z.object({ reason: z.string().trim().min(3).max(300) });
