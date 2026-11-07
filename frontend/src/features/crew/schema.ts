import { z } from "zod";
import { ABSENCE_REASONS } from "@/features/absences/schema";
import {
  arrivalWindowSchema,
  busTypeSchema,
  clockTimeSchema,
  lineSummarySchema,
} from "@/features/lines/schema";
import { sosSummarySchema } from "@/features/sos/schema";
import { calendarDateSchema } from "@/features/subscriptions/schema";
import { TripDirection } from "@/features/trips/schema";
import { Role } from "@/lib/auth/roles";

/**
 * The driver's or supervisor's day: the bus they run, its trips and who rides them. The crew
 * presses start and end themselves (to tell outbound from return); the bus's position comes
 * from the GPS device installed in it, never from the crew's phone.
 */

/** not_started → in_progress → ended. */
export const CrewTripStatus = {
  NotStarted: "not_started",
  InProgress: "in_progress",
  Ended: "ended",
} as const;
export type CrewTripStatus = (typeof CrewTripStatus)[keyof typeof CrewTripStatus];
const CREW_TRIP_STATUSES = Object.values(CrewTripStatus) as [CrewTripStatus, ...CrewTripStatus[]];

/**
 * One subscriber on this trip.
 * waiting: not scanned yet · boarded: scanned on board · checked_out: left mid-trip with a
 * reason · not_going: reported the day off · absent: not scanned when the trip ended.
 */
export const RiderState = {
  Waiting: "waiting",
  Boarded: "boarded",
  CheckedOut: "checked_out",
  NotGoing: "not_going",
  Absent: "absent",
} as const;
export type RiderState = (typeof RiderState)[keyof typeof RiderState];
export const RIDER_STATES = Object.values(RiderState) as [RiderState, ...RiderState[]];

/** Why a student left the bus before the end of the trip. The guardian is told at once. */
export const CheckoutReason = {
  Unwell: "unwell",
  GuardianPickup: "guardian_pickup",
  Personal: "personal",
  Other: "other",
} as const;
export type CheckoutReason = (typeof CheckoutReason)[keyof typeof CheckoutReason];
export const CHECKOUT_REASONS = Object.values(CheckoutReason) as [
  CheckoutReason,
  ...CheckoutReason[],
];

export const ScanAction = { Board: "board", Checkout: "checkout" } as const;
export type ScanAction = (typeof ScanAction)[keyof typeof ScanAction];

/** qr: the student's pass was scanned · manual: typed by the crew (phone dead, no pass). */
export const ScanMethod = { Qr: "qr", Manual: "manual" } as const;
export type ScanMethod = (typeof ScanMethod)[keyof typeof ScanMethod];

export const DelayReason = {
  Traffic: "traffic",
  Breakdown: "breakdown",
  Weather: "weather",
  RoadClosed: "road_closed",
  Other: "other",
} as const;
export type DelayReason = (typeof DelayReason)[keyof typeof DelayReason];
export const DELAY_REASONS = Object.values(DelayReason) as [DelayReason, ...DelayReason[]];

/** The delays the crew can pick, in minutes. */
export const DELAY_MINUTES = [5, 10, 15, 20, 30, 45, 60] as const;
export const CREW_NOTE_MAX_LENGTH = 200;

export const CrewErrorCode = {
  /** The account isn't on any bus today. */
  NoAssignment: "NO_ASSIGNMENT",
  /** The trip belongs to another bus. */
  NotYourTrip: "NOT_YOUR_TRIP",
  TripAlreadyStarted: "TRIP_ALREADY_STARTED",
  TripAlreadyEnded: "TRIP_ALREADY_ENDED",
  TripNotStarted: "TRIP_NOT_STARTED",
  /** Only one trip runs at a time: end the outbound trip before starting the return. */
  OtherTripInProgress: "OTHER_TRIP_IN_PROGRESS",
  /** The QR code isn't a pass, or its signature is wrong. */
  CardInvalid: "CARD_INVALID",
  /** The pass is older than 30 seconds (a screenshot): the student opens it again. */
  CardExpired: "CARD_EXPIRED",
  /** No student with that university ID. */
  StudentNotFound: "STUDENT_NOT_FOUND",
  /** Not an active subscriber of this line. */
  NotOnThisTrip: "NOT_ON_THIS_TRIP",
  AlreadyBoarded: "ALREADY_BOARDED",
  /** A check-out for someone who isn't on board. */
  NotOnBoard: "NOT_ON_BOARD",
  /** A check-out needs a reason. */
  ReasonRequired: "REASON_REQUIRED",
} as const;
export type CrewErrorCode = (typeof CrewErrorCode)[keyof typeof CrewErrorCode];

export const tripParamsSchema = z.object({ trip_id: z.string().min(1) });

export const riderSchema = z.object({
  student_id: z.string(),
  /** In the request's language. */
  name: z.string(),
  /** University ID. */
  identifier: z.string(),
  stop_order: z.number().int().positive(),
  stop_name: z.string(),
  pickup_time: clockTimeSchema.nullable(),
  state: z.enum(RIDER_STATES),
  boarded_at: z.iso.datetime().nullable(),
  checked_out_at: z.iso.datetime().nullable(),
  checkout_reason: z.enum(CHECKOUT_REASONS).nullable(),
  checkout_note: z.string().nullable(),
  /** How the boarding was recorded. null until boarded. */
  scan_method: z.enum([ScanMethod.Qr, ScanMethod.Manual]).nullable(),
  /** For not_going: the reason the student gave. */
  not_going_reason: z.enum(ABSENCE_REASONS).nullable(),
});
export type Rider = z.infer<typeof riderSchema>;

export const riderCountsSchema = z.object({
  total: z.number().int().nonnegative(),
  waiting: z.number().int().nonnegative(),
  boarded: z.number().int().nonnegative(),
  checked_out: z.number().int().nonnegative(),
  not_going: z.number().int().nonnegative(),
  absent: z.number().int().nonnegative(),
});
export type RiderCounts = z.infer<typeof riderCountsSchema>;

export const tripDelaySchema = z.object({
  delay_id: z.string(),
  minutes: z.number().int().positive(),
  reason: z.enum(DELAY_REASONS),
  note: z.string().nullable(),
  reported_at: z.iso.datetime(),
});
export type TripDelay = z.infer<typeof tripDelaySchema>;

export const crewTripSchema = z.object({
  trip_id: z.string(),
  direction: z.enum([TripDirection.Outbound, TripDirection.Return]),
  status: z.enum(CREW_TRIP_STATUSES),
  /** Outbound: pickup time at the first stop. Return: null until the office publishes it. */
  departure_time: clockTimeSchema.nullable(),
  started_at: z.iso.datetime().nullable(),
  ended_at: z.iso.datetime().nullable(),
  /** Everyone subscribed on the line, in stop order. */
  riders: z.array(riderSchema),
  counts: riderCountsSchema,
  /** Oldest first. */
  delays: z.array(tripDelaySchema),
  /** The latest SOS raised on this trip, if any. */
  sos: sosSummarySchema.nullable(),
});
export type CrewTrip = z.infer<typeof crewTripSchema>;

export const crewStopSchema = z.object({
  order: z.number().int().positive(),
  name: z.string(),
  pickup_time: clockTimeSchema.nullable(),
});
export type CrewStop = z.infer<typeof crewStopSchema>;

export const crewTodaySchema = z.object({
  service_date: calendarDateSchema,
  /** Friday, Saturday and holidays have no trips. */
  is_service_day: z.boolean(),
  crew_role: z.enum([Role.Driver, Role.Supervisor]),
  line: lineSummarySchema,
  bus: z.object({
    bus_id: z.string(),
    bus_type: busTypeSchema,
    plate: z.string(),
    seats: z.number().int().positive(),
  }),
  stops: z.array(crewStopSchema),
  campus_arrival: arrivalWindowSchema,
  /** Today's outbound trip, then the return. Empty on a day without service. */
  trips: z.array(crewTripSchema),
});
export type CrewToday = z.infer<typeof crewTodaySchema>;

export const scanBodySchema = z
  .object({
    action: z.enum([ScanAction.Board, ScanAction.Checkout]),
    method: z.enum([ScanMethod.Qr, ScanMethod.Manual]),
    /** The text inside the pass's QR code (method qr). */
    qr_token: z.string().min(1).nullable(),
    /** University ID typed by the crew (method manual). */
    identifier: z.string().trim().min(1).max(20).nullable(),
    /** Check-out only. */
    reason: z.enum(CHECKOUT_REASONS).nullable(),
    note: z.string().trim().max(CREW_NOTE_MAX_LENGTH).nullable(),
  })
  .refine((body) => (body.method === ScanMethod.Qr ? body.qr_token : body.identifier), {
    message: "qr_token for qr, identifier for manual",
  });
export type ScanBody = z.input<typeof scanBodySchema>;

export const scanResultSchema = z.object({ rider: riderSchema, counts: riderCountsSchema });
export type ScanResult = z.infer<typeof scanResultSchema>;

export const delayBodySchema = z.object({
  minutes: z.number().int().positive().max(180),
  reason: z.enum(DELAY_REASONS),
  note: z.string().trim().max(CREW_NOTE_MAX_LENGTH).nullable(),
});
export type DelayBody = z.infer<typeof delayBodySchema>;
