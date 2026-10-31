import { z } from "zod";
import { Id, IsoDate } from "@/lib/api/common";

export const PermitKind = { PrioritySeat: "priority_seat", MedicalLeave: "medical_leave", Escort: "escort" } as const;

export const Permit = z.object({
  id: Id,
  student_id: z.string(),
  student_name: z.string(),
  kind: z.enum(["priority_seat", "medical_leave", "escort"]),
  from: IsoDate,
  to: IsoDate,
  issued_by: z.string(),
  status: z.enum(["active", "revoked", "expired"]),
});
export type Permit = z.infer<typeof Permit>;

export const NewPermit = z.object({
  student_id: z.string().regex(/^\d{9}$/),
  kind: z.enum(["priority_seat", "medical_leave", "escort"]),
  from: IsoDate,
  to: IsoDate,
});
