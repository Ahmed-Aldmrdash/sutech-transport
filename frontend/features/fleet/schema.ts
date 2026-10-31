import { z } from "zod";
import { ClockTime, Id, Money } from "@/lib/api/common";

export const BusStatus = { Ok: "ok", Repair: "repair" } as const;

export const Bus = z.object({
  id: Id,
  plate: z.string(),
  type: z.string(),
  capacity: z.number().int().positive(),
  operator: z.enum(["university", "bus_company"]),
  driver_name: z.string().nullable(),
  line_id: Id.nullable(),
  line_name: z.string().nullable(),
  status: z.enum(["ok", "repair"]),
});
export type Bus = z.infer<typeof Bus>;

export const BusInput = z.object({
  plate: z.string().trim().min(3).max(20),
  type: z.string().trim().min(3).max(40),
  capacity: z.number().int().min(8).max(80),
  operator: z.enum(["university", "bus_company"]),
  driver_name: z.string().trim().max(60).nullable(),
  status: z.enum(["ok", "repair"]),
});
export type BusInput = z.infer<typeof BusInput>;

export const NewLine = z.object({
  name: z.string().trim().min(3).max(60),
  price: Money.min(100),
  bus_id: Id,
  stops: z
    .array(z.object({ name: z.string().trim().min(2).max(60), time: ClockTime }))
    .min(1)
    .max(15),
});
export const LinePrice = z.object({ price: Money.min(100) });
export const NewStop = z.object({ name: z.string().trim().min(2).max(60), time: ClockTime });
export const StopToggle = z.object({ active: z.boolean() });
