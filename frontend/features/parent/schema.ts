import { z } from "zod";
import { Id } from "@/lib/api/common";
import { Subscription } from "@/features/subscriptions/schema";

export const Child = z.object({
  student_id: z.string(),
  name: z.string(),
  faculty: z.string(),
  level: z.string(),
  subscription: Subscription,
  line_id: Id.nullable(),
});
export type Child = z.infer<typeof Child>;
