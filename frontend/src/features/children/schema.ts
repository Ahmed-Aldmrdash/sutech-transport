import { z } from "zod";
import { isoDateTime } from "@/lib/api/iso-datetime";
import { tripRecordSchema } from "@/features/attendance/schema";
import {
  arrivalWindowSchema,
  busSchema,
  clockTimeSchema,
  lineSummarySchema,
} from "@/features/lines/schema";
import { ABSENCE_REASONS } from "@/features/absences/schema";
import { calendarDateSchema, subscriptionSchema } from "@/features/subscriptions/schema";

export const childParamsSchema = z.object({ student_id: z.string().min(1) });

export const ChildErrorCode = {
  /** The guardian asked about a student who isn't linked to them. */
  NotYourChild: "NOT_YOUR_CHILD",
} as const;

/** One student the guardian follows, as listed on the guardian's home. */
export const childSchema = z.object({
  student_id: z.string(),
  /** In the request's language. */
  name: z.string(),
  /** University ID. */
  identifier: z.string(),
  faculty: z.string().nullable(),
  level: z.number().int().nullable(),
  /** null when the student has no booking this term. */
  subscription: z
    .object({
      status: subscriptionSchema.shape.status,
      line: lineSummarySchema,
      stop: z.object({ name: z.string(), pickup_time: clockTimeSchema.nullable() }),
    })
    .nullable(),
});
export type Child = z.infer<typeof childSchema>;

export const childrenListSchema = z.object({ children: z.array(childSchema) });
export type ChildrenList = z.infer<typeof childrenListSchema>;

/**
 * Where the child is in today's trip to campus.
 * no_subscription · no_service (Friday, Saturday or a holiday) · not_going (the student said
 * they won't ride today) · waiting (the bus hasn't left yet) · bus_on_way (the bus left its
 * first stop) · boarded (card scanned on the bus) · arrived (at campus) · checked_out (left
 * the bus mid-trip, with a reason) · absent (the bus reached campus without them).
 */
export const ChildDayStatus = {
  NoSubscription: "no_subscription",
  NoService: "no_service",
  NotGoing: "not_going",
  Waiting: "waiting",
  BusOnWay: "bus_on_way",
  Boarded: "boarded",
  Arrived: "arrived",
  CheckedOut: "checked_out",
  Absent: "absent",
} as const;
export type ChildDayStatus = (typeof ChildDayStatus)[keyof typeof ChildDayStatus];
const CHILD_DAY_STATUSES = Object.values(ChildDayStatus) as [ChildDayStatus, ...ChildDayStatus[]];

/** Things that happened today, in order. Each one also reaches the guardian as a notification. */
export const DayEventKind = {
  NotGoing: "not_going",
  BusLeft: "bus_left",
  Boarded: "boarded",
  Arrived: "arrived",
  CheckedOut: "checked_out",
  Absent: "absent",
} as const;
export type DayEventKind = (typeof DayEventKind)[keyof typeof DayEventKind];
const DAY_EVENT_KINDS = Object.values(DayEventKind) as [DayEventKind, ...DayEventKind[]];

export const dayEventSchema = z.object({
  kind: z.enum(DAY_EVENT_KINDS),
  at: isoDateTime(),
  /** Stop name, check-out reason or the student's note, in the request's language. */
  detail: z.string().nullable(),
});
export type DayEvent = z.infer<typeof dayEventSchema>;

export const childDaySchema = z.object({
  student_id: z.string(),
  service_date: calendarDateSchema,
  status: z.enum(CHILD_DAY_STATUSES),
  /** Today's trip, or null without an active subscription. */
  trip: z
    .object({
      line: lineSummarySchema,
      stop: z.object({ name: z.string(), pickup_time: clockTimeSchema.nullable() }),
      campus_arrival: arrivalWindowSchema,
      /** Includes the driver's mobile: the guardian's child rides this bus. */
      bus: busSchema,
    })
    .nullable(),
  /** Oldest first. */
  events: z.array(dayEventSchema),
  /** The last few service days before today, newest first. */
  recent: z.array(tripRecordSchema),
  /** Days from today on the child said they won't ride, soonest first. */
  days_off: z.array(
    z.object({
      service_date: calendarDateSchema,
      reason: z.enum(ABSENCE_REASONS),
      note: z.string().nullable(),
      reported_at: isoDateTime(),
    }),
  ),
});
export type ChildDay = z.infer<typeof childDaySchema>;
