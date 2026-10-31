import { z } from "zod";
import { Id, IsoDate } from "@/lib/api/common";

export const EventStatus = {
  AwaitingCompany: "awaiting_company",
  Confirmed: "confirmed",
  CompanyDeclined: "company_declined",
  Cancelled: "cancelled",
} as const;

export const EventBooking = z.object({
  id: Id,
  name: z.string(),
  date: IsoDate,
  students: z.number().int().positive(),
  buses_needed: z.number().int().positive(),
  university_buses: z.array(z.string()),
  company_buses: z.number().int().nonnegative(),
  status: z.enum(["awaiting_company", "confirmed", "company_declined", "cancelled"]),
});
export type EventBooking = z.infer<typeof EventBooking>;

export const NewEvent = z.object({
  name: z.string().trim().min(3).max(80),
  date: IsoDate,
  students: z.number().int().min(1).max(5000),
});
export const CompanyDecision = z.object({ accept: z.boolean() });
