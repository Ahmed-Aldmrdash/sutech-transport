import { z } from "zod";
import { Id, IsoDateTime } from "@/lib/api/common";

export const SosKind = { Medical: "medical", BusIssue: "bus_issue", Accident: "accident" } as const;
export type SosKind = (typeof SosKind)[keyof typeof SosKind];

export const SosStatus = { New: "new", Acknowledged: "acknowledged", Closed: "closed" } as const;

export const Sos = z.object({
  id: Id,
  kind: z.enum(["medical", "bus_issue", "accident"]),
  status: z.enum(["new", "acknowledged", "closed"]),
  trip_id: Id,
  line_id: Id,
  line_name: z.string(),
  bus_plate: z.string(),
  driver_name: z.string(),
  note: z.string(),
  position: z.object({ lat: z.number(), lng: z.number() }).nullable(),
  created_at: IsoDateTime,
  ambulance_requested: z.boolean(),
  replacement_bus_plate: z.string().nullable(),
  log: z.array(z.object({ at: IsoDateTime, text: z.string(), by: z.string() })),
});
export type Sos = z.infer<typeof Sos>;

export const RaiseSos = z.object({
  trip_id: Id,
  kind: z.enum(["medical", "bus_issue", "accident"]),
  note: z.string().trim().max(300),
});

export const SosAction = z.discriminatedUnion("action", [
  z.object({ action: z.literal("acknowledge") }),
  z.object({ action: z.literal("request_ambulance") }),
  z.object({ action: z.literal("note"), note: z.string().trim().min(3).max(300) }),
  z.object({ action: z.literal("close"), note: z.string().trim().min(3).max(300) }),
]);
export type SosAction = z.infer<typeof SosAction>;

export const Replacement = z.object({
  bus_id: Id,
  reason: z.string().trim().min(3).max(200),
});
