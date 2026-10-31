import { z } from "zod";
import { Id, IsoDateTime } from "@/lib/api/common";

export const ComplaintCategory = {
  Delay: "delay",
  Driver: "driver",
  Cleanliness: "cleanliness",
  AirConditioning: "air_conditioning",
  Payment: "payment",
  Other: "other",
} as const;
export type ComplaintCategory = (typeof ComplaintCategory)[keyof typeof ComplaintCategory];
const CATEGORIES = Object.values(ComplaintCategory) as [ComplaintCategory, ...ComplaintCategory[]];

export const Complaint = z.object({
  id: Id,
  student_id: z.string(),
  student_name: z.string(),
  category: z.enum(CATEGORIES),
  text: z.string(),
  created_at: IsoDateTime,
  status: z.enum(["new", "answered"]),
  reply: z.string().nullable(),
});
export type Complaint = z.infer<typeof Complaint>;

export const ComplaintList = z.object({ items: z.array(Complaint), total: z.number().int() });
export const NewComplaint = z.object({
  category: z.enum(CATEGORIES),
  text: z.string().trim().min(10).max(1000),
});
export const Reply = z.object({ reply: z.string().trim().min(3).max(1000) });
