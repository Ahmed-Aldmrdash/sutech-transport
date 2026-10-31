import { z } from "zod";
import { Id, IsoDateTime } from "@/lib/api/common";

export const RiderState = {
  Waiting: "waiting",
  Boarded: "boarded",
  CheckedOut: "checked_out",
  Absent: "absent",
  Skipped: "skipped",
} as const;
export type RiderState = (typeof RiderState)[keyof typeof RiderState];

export const Rider = z.object({
  student_id: z.string(),
  name: z.string(),
  stop_name: z.string(),
  state: z.enum(Object.values(RiderState) as [RiderState, ...RiderState[]]),
  at: IsoDateTime.nullable(),
  detail: z.string().nullable(),
  /** The clinic issued a priority-seat permit. */
  priority_seat: z.boolean(),
});
export type Rider = z.infer<typeof Rider>;

export const CrewTrip = z.object({
  trip_id: Id,
  line_id: Id,
  line_name: z.string(),
  bus_plate: z.string(),
  driver_name: z.string(),
  direction: z.enum(["outbound", "return"]),
  state: z.enum(["not_started", "in_progress", "ended"]),
  started_at: IsoDateTime.nullable(),
  ended_at: IsoDateTime.nullable(),
  delay_minutes: z.number().int().nonnegative(),
  riders: z.array(Rider),
  open_sos_id: Id.nullable(),
});
export type CrewTrip = z.infer<typeof CrewTrip>;

export const StartTrip = z.object({ direction: z.enum(["outbound", "return"]) });

export const CheckoutReason = {
  Illness: "illness",
  FamilyReason: "family_reason",
  GotOffNearHome: "got_off_near_home",
  Other: "other",
} as const;

export const Scan = z.discriminatedUnion("action", [
  z.object({ action: z.literal("board"), card: z.string().min(9).max(200) }),
  z.object({
    action: z.literal("checkout"),
    card: z.string().min(9).max(200),
    reason: z.enum(["illness", "family_reason", "got_off_near_home", "other"]),
    note: z.string().trim().max(200).nullable(),
  }),
]);
export type Scan = z.infer<typeof Scan>;

export const ScanResult = z.object({ rider: Rider });

export const ReportDelay = z.object({
  minutes: z.number().int().min(1).max(180),
  reason: z.enum(["traffic", "breakdown", "weather", "checkpoint", "other"]),
});
