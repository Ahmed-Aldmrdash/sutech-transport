import { z } from "zod";
import { isoDateTime } from "@/lib/api/iso-datetime";
import {
  BusType,
  busTypeSchema,
  clockTimeSchema,
  lineSummarySchema,
} from "@/features/lines/schema";

/**
 * Buses for a university event (military education, Open Day, a field trip…). Every bus
 * belongs to Abu El Hol, so the Transportation office asks the company for buses, and the
 * company confirms with the buses and drivers it sends, or declines. No student data goes to
 * the company: only how many students, when and where.
 */

export const EventKind = {
  MilitaryEducation: "military_education",
  OpenDay: "open_day",
  Competition: "competition",
  FieldTrip: "field_trip",
  Sports: "sports",
  Other: "other",
} as const;
export type EventKind = (typeof EventKind)[keyof typeof EventKind];
export const EVENT_KINDS = Object.values(EventKind) as [EventKind, ...EventKind[]];

export const EventStatus = {
  /** Sent to Abu El Hol, no answer yet. */
  WaitingCompany: "waiting_company",
  /** The company named the buses and drivers it sends. */
  Confirmed: "confirmed",
  /** The company can't send buses that day. */
  Declined: "declined",
  /** The Transportation office called it off. */
  Cancelled: "cancelled",
} as const;
export type EventStatus = (typeof EventStatus)[keyof typeof EventStatus];
export const EVENT_STATUSES = Object.values(EventStatus) as [EventStatus, ...EventStatus[]];

export const EventAction = {
  /** Transportation office: call it off (waiting or confirmed, before the day ends). */
  Cancel: "cancel",
  /** Abu El Hol: name the buses it sends. */
  Confirm: "confirm",
  /** Abu El Hol: can't send buses. */
  Decline: "decline",
} as const;
export type EventAction = (typeof EventAction)[keyof typeof EventAction];
const EVENT_ACTIONS = Object.values(EventAction) as [EventAction, ...EventAction[]];

export const EventErrorCode = {
  /** The day is today, in the past, or too far ahead. */
  DateInvalid: "EVENT_DATE_INVALID",
  /** The return is not after the departure. */
  TimesInvalid: "EVENT_TIMES_INVALID",
  /** The buses asked for can't seat the students. */
  NotEnoughSeats: "NOT_ENOUGH_SEATS",
  /** The same event on the same day is already asked for. */
  Duplicate: "EVENT_DUPLICATE",
  /** Cancelled, declined, or its day is over: nothing more to do. */
  Closed: "EVENT_CLOSED",
  /** The company already answered. */
  NotWaiting: "EVENT_NOT_WAITING",
  /** A bus isn't the company's, or goes to another event that day. */
  BusNotAvailable: "BUS_NOT_AVAILABLE",
  /** More buses than asked for, none, or the same bus twice. */
  BusesInvalid: "BUSES_INVALID",
  /** Cancelling or declining needs a reason the other side reads. */
  ReasonRequired: "REASON_REQUIRED",
} as const;
export type EventErrorCode = (typeof EventErrorCode)[keyof typeof EventErrorCode];

export const EVENT_TITLE_MIN_LENGTH = 3;
export const EVENT_TITLE_MAX_LENGTH = 80;
export const EVENT_PLACE_MIN_LENGTH = 3;
export const EVENT_PLACE_MAX_LENGTH = 120;
export const EVENT_NOTE_MAX_LENGTH = 500;
export const EVENT_REASON_MIN_LENGTH = 5;
export const EVENT_STUDENTS_MAX = 2000;
export const EVENT_BUSES_MAX = 30;
/** How far ahead an event can be asked for. */
export const EVENT_DAYS_AHEAD_MAX = 120;
const PAGE_SIZE_MAX = 50;

/**
 * Seats per bus type, as the server counts them for NOT_ENOUGH_SEATS. Estimates until Abu El
 * Hol sends the exact count of each bus.
 */
export const EVENT_SEATS_BY_BUS: Readonly<Record<BusType, number>> = {
  [BusType.Minibus]: 14,
  [BusType.Coaster]: 28,
  [BusType.Midibus]: 33,
  [BusType.LargeBus]: 50,
};

const dateSchema = z.iso.date();

/** One bus the company sends, with its driver. */
export const eventBusSchema = z.object({
  bus_id: z.string(),
  plate: z.string(),
  bus_type: busTypeSchema,
  seats: z.number().int().positive(),
  driver_name: z.string(),
  driver_phone: z.string(),
});
export type EventBus = z.infer<typeof eventBusSchema>;

export const busEventSchema = z.object({
  event_id: z.string(),
  /** Shown to both sides, e.g. "EVT-0007". */
  reference: z.string(),
  kind: z.enum(EVENT_KINDS),
  /** As the office typed it. */
  title: z.string(),
  event_date: dateSchema,
  /** Cairo time, "HH:MM". */
  departs_at: clockTimeSchema,
  returns_at: clockTimeSchema.nullable(),
  pickup: z.string(),
  destination: z.string(),
  students_count: z.number().int().positive(),
  bus_type: busTypeSchema,
  buses_requested: z.number().int().positive(),
  /** buses_requested × seats of the bus type. */
  seats_requested: z.number().int().positive(),
  note: z.string().nullable(),
  status: z.enum(EVENT_STATUSES),
  /** The day is over (or cancelled/declined): read-only for everyone. */
  is_past: z.boolean(),
  requested_by_name: z.string(),
  created_at: isoDateTime(),
  company_reply: z
    .object({
      buses: z.array(eventBusSchema),
      note: z.string().nullable(),
      by_name: z.string(),
      at: isoDateTime(),
    })
    .nullable(),
  cancellation: z.object({ reason: z.string(), by_name: z.string(), at: isoDateTime() }).nullable(),
  /** What the caller may do now. */
  allowed_actions: z.array(z.enum(EVENT_ACTIONS)),
});
export type BusEvent = z.infer<typeof busEventSchema>;

export const eventListQuerySchema = z.object({
  status: z.enum(EVENT_STATUSES).optional(),
  page: z.number().int().positive().optional(),
  page_size: z.number().int().positive().max(PAGE_SIZE_MAX).optional(),
});
export type EventListQuery = z.input<typeof eventListQuerySchema>;

export const eventListSchema = z.object({
  /** Waiting first (soonest first), then the coming days, then the past (newest first). */
  items: z.array(busEventSchema),
  total: z.number().int().nonnegative(),
  counts: z.object({
    waiting_company: z.number().int().nonnegative(),
    confirmed: z.number().int().nonnegative(),
    declined: z.number().int().nonnegative(),
    cancelled: z.number().int().nonnegative(),
  }),
});
export type EventList = z.infer<typeof eventListSchema>;

export const eventParamsSchema = z.object({ event_id: z.string().min(1) });

export const createEventBodySchema = z.object({
  kind: z.enum(EVENT_KINDS),
  title: z.string().trim().min(EVENT_TITLE_MIN_LENGTH).max(EVENT_TITLE_MAX_LENGTH),
  event_date: dateSchema,
  departs_at: clockTimeSchema,
  returns_at: clockTimeSchema.nullable(),
  pickup: z.string().trim().min(EVENT_PLACE_MIN_LENGTH).max(EVENT_PLACE_MAX_LENGTH),
  destination: z.string().trim().min(EVENT_PLACE_MIN_LENGTH).max(EVENT_PLACE_MAX_LENGTH),
  students_count: z.number().int().min(1).max(EVENT_STUDENTS_MAX),
  bus_type: busTypeSchema,
  buses_requested: z.number().int().min(1).max(EVENT_BUSES_MAX),
  note: z.string().trim().max(EVENT_NOTE_MAX_LENGTH).nullable(),
});
export type CreateEventBody = z.infer<typeof createEventBodySchema>;

export const cancelEventBodySchema = z.object({
  reason: z.string().trim().min(EVENT_REASON_MIN_LENGTH).max(EVENT_NOTE_MAX_LENGTH),
});
export type CancelEventBody = z.infer<typeof cancelEventBodySchema>;

export const CompanyDecision = {
  Confirm: EventAction.Confirm,
  Decline: EventAction.Decline,
} as const;
export type CompanyDecision = (typeof CompanyDecision)[keyof typeof CompanyDecision];

export const companyReplyBodySchema = z
  .object({
    decision: z.enum([CompanyDecision.Confirm, CompanyDecision.Decline]),
    /** Confirm: 1 to buses_requested of the company's buses. Decline: empty. */
    bus_ids: z.array(z.string().min(1)).max(EVENT_BUSES_MAX),
    note: z.string().trim().max(EVENT_NOTE_MAX_LENGTH).nullable(),
  })
  .refine(
    (body) =>
      body.decision === CompanyDecision.Confirm ||
      (body.note ?? "").length >= EVENT_REASON_MIN_LENGTH,
    { message: "declining needs a reason", path: ["note"] },
  );
export type CompanyReplyBody = z.infer<typeof companyReplyBodySchema>;

/** The company's view of one request: the event and the buses it could send that day. */
export const companyRequestSchema = z.object({
  event: busEventSchema,
  /** The company's buses with no other event that day (a line bus still runs its line). */
  available_buses: z.array(
    eventBusSchema.extend({
      /** The line it runs in the morning and afternoon, if any. */
      line: lineSummarySchema.nullable(),
    }),
  ),
});
export type CompanyRequest = z.infer<typeof companyRequestSchema>;

// ---------------------------------------------------------------------------------------------
// The company's fleet

export const FleetBusState = {
  /** Runs its own line today. */
  OnLine: "on_line",
  /** Sent to a line in place of its bus today (breakdown, accident…). */
  Replacement: "replacement",
  /** At the garage, free. */
  Spare: "spare",
} as const;
export type FleetBusState = (typeof FleetBusState)[keyof typeof FleetBusState];

export const fleetBusSchema = eventBusSchema.extend({
  line: lineSummarySchema.nullable(),
  today: z.enum([FleetBusState.OnLine, FleetBusState.Replacement, FleetBusState.Spare]),
  /** Replacement: the line it covers today. */
  covering_line: lineSummarySchema.nullable(),
  /** Today's event, if the bus goes to one. */
  event_today: z.object({ event_id: z.string(), title: z.string() }).nullable(),
});
export type FleetBus = z.infer<typeof fleetBusSchema>;

export const fleetSchema = z.object({
  items: z.array(fleetBusSchema),
  counts: z.object({
    total: z.number().int().nonnegative(),
    on_line: z.number().int().nonnegative(),
    spare: z.number().int().nonnegative(),
    seats: z.number().int().nonnegative(),
  }),
});
export type Fleet = z.infer<typeof fleetSchema>;
