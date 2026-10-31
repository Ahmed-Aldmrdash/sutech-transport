import { z } from "zod";
import { Id, IsoDateTime } from "@/lib/api/common";

export const ViolationType = {
  Smoking: "smoking",
  RefusedCard: "refused_card",
  Damage: "damage",
  Misconduct: "misconduct",
  Other: "other",
} as const;
export type ViolationType = (typeof ViolationType)[keyof typeof ViolationType];
const TYPES = Object.values(ViolationType) as [ViolationType, ...ViolationType[]];

export const Violation = z.object({
  id: Id,
  student_id: z.string(),
  student_name: z.string(),
  type: z.enum(TYPES),
  description: z.string(),
  photo: z.string().nullable(),
  reported_by: z.string(),
  created_at: IsoDateTime,
  status: z.enum(["new", "referred", "dismissed"]),
});
export type Violation = z.infer<typeof Violation>;

export const NewViolation = z.object({
  student_id: z.string().regex(/^\d{9}$/),
  type: z.enum(TYPES),
  description: z.string().trim().min(10).max(500),
  photo: z.string().startsWith("data:image/").nullable(),
});
export const ViolationDecision = z.object({ status: z.enum(["referred", "dismissed"]) });
