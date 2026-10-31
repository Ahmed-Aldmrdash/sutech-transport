import { z } from "zod";
import { Id, IsoDateTime, Money } from "@/lib/api/common";

export const FeedItem = z.object({ at: IsoDateTime, text: z.string() });

export const Overview = z.object({
  active_subscribers: z.number().int(),
  seats_total: z.number().int(),
  seats_booked: z.number().int(),
  pending_payments: z.number().int(),
  open_requests: z.number().int(),
  open_sos: z.number().int(),
  trips_running: z.number().int(),
  revenue_term: Money,
  lines: z.array(
    z.object({
      line_id: Id,
      line_name: z.string(),
      capacity: z.number().int(),
      booked: z.number().int(),
      delay_minutes: z.number().int(),
    }),
  ),
  feed: z.array(FeedItem),
});
export type Overview = z.infer<typeof Overview>;

export const AuditEntry = z.object({ at: IsoDateTime, actor: z.string(), action: z.string() });
export type AuditEntry = z.infer<typeof AuditEntry>;
export const AuditPage = z.object({ items: z.array(AuditEntry), total: z.number().int() });

export const AdminUser = z.object({
  id: Id,
  name: z.string(),
  role: z.string(),
  active: z.boolean(),
});
export type AdminUser = z.infer<typeof AdminUser>;
export const NewUser = z.object({ name: z.string().trim().min(3).max(60), role: z.string() });
export const UserUpdate = z.object({ active: z.boolean().optional(), role: z.string().optional() });
