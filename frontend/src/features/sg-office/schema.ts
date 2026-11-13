import { z } from "zod";
import { isoDateTime } from "@/lib/api/iso-datetime";
import { EVENT_KINDS, EVENT_STATUSES } from "@/features/event-buses/schema";
import { busTypeSchema, clockTimeSchema, lineSummarySchema } from "@/features/lines/schema";
import { SOS_STATUSES, SOS_TYPES } from "@/features/sos/schema";

/**
 * The Secretary General's page (read-only): who rode today and which lines run late, without a
 * phone call; open emergencies and today's event buses; and a short list of students the
 * office follows by name. Nothing here changes anything.
 */

export const LineDayStatus = {
  /** Friday, Saturday or a holiday. */
  NoService: "no_service",
  NotStarted: "not_started",
  InProgress: "in_progress",
  Ended: "ended",
} as const;
export type LineDayStatus = (typeof LineDayStatus)[keyof typeof LineDayStatus];
const LINE_DAY_STATUSES = Object.values(LineDayStatus) as [LineDayStatus, ...LineDayStatus[]];

/** One followed student's morning trip. */
export const WatchedStatus = {
  NoService: "no_service",
  /** Not subscribed on any line that day. */
  NoSubscription: "no_subscription",
  /** The bus hasn't reached their stop yet. */
  Waiting: "waiting",
  /** Scanned on board, the bus is on its way. */
  OnBus: "on_bus",
  /** Scanned on board, the bus reached campus. */
  Arrived: "arrived",
  /** Left the bus on the way, with a reason. */
  CheckedOut: "checked_out",
  /** Said "not going today". */
  NotGoing: "not_going",
  /** Not scanned when the trip ended. */
  Absent: "absent",
} as const;
export type WatchedStatus = (typeof WatchedStatus)[keyof typeof WatchedStatus];
const WATCHED_STATUSES = Object.values(WatchedStatus) as [WatchedStatus, ...WatchedStatus[]];

export const SgErrorCode = {
  /** The day is in the future or more than 31 days back. */
  DateInvalid: "DATE_INVALID",
  StudentNotFound: "STUDENT_NOT_FOUND",
  AlreadyWatched: "ALREADY_WATCHED",
  WatchlistFull: "WATCHLIST_FULL",
} as const;
export type SgErrorCode = (typeof SgErrorCode)[keyof typeof SgErrorCode];

/** How far back the page can look. */
export const SG_DAYS_BACK_MAX = 31;
export const WATCHLIST_MAX = 20;
const IDENTIFIER_MAX_LENGTH = 20;

const count = z.number().int().nonnegative();

export const sgDayQuerySchema = z.object({
  /** Cairo date; today when left out. */
  date: z.iso.date().optional(),
});
export type SgDayQuery = z.input<typeof sgDayQuerySchema>;

export const sgLineSchema = z.object({
  line: lineSummarySchema,
  /** The bus and driver that day (after any replacement). */
  bus: z.object({ plate: z.string(), bus_type: busTypeSchema, driver_name: z.string() }),
  /** The Transportation office sent another bus or driver that day. */
  replaced: z.boolean(),
  status: z.enum(LINE_DAY_STATUSES),
  subscribers: count,
  /** Scanned on board (including those who left on the way). */
  rode: count,
  not_going: count,
  /** Not scanned when the trip ended. 0 until it ends. */
  absent: count,
  /** The crew's latest delay report that day, in minutes. */
  delay_minutes: z.number().int().positive().nullable(),
});
export type SgLine = z.infer<typeof sgLineSchema>;

export const sgOverviewSchema = z.object({
  date: z.iso.date(),
  is_today: z.boolean(),
  is_service_day: z.boolean(),
  /** On a day with no buses: the latest earlier day that had them (up to a month back). */
  previous_service_day: z.iso.date().nullable(),
  generated_at: isoDateTime(),
  totals: z.object({
    lines: count,
    lines_running: count,
    lines_delayed: count,
    subscribers: count,
    rode: count,
    not_going: count,
    absent: count,
  }),
  /** In the university's line order. */
  lines: z.array(sgLineSchema),
  /** SOS alerts raised that day, newest first. */
  emergencies: z.array(
    z.object({
      sos_id: z.string(),
      type: z.enum(SOS_TYPES),
      status: z.enum(SOS_STATUSES),
      line: lineSummarySchema,
      raised_at: isoDateTime(),
    }),
  ),
  /** Event buses that day (waiting for Abu El Hol or confirmed). */
  events: z.array(
    z.object({
      event_id: z.string(),
      reference: z.string(),
      kind: z.enum(EVENT_KINDS),
      title: z.string(),
      status: z.enum(EVENT_STATUSES),
      departs_at: clockTimeSchema,
      destination: z.string(),
      students_count: count,
      buses: count,
    }),
  ),
  /** Crew violation reports Student Affairs hasn't opened yet. */
  violations_new: count,
});
export type SgOverview = z.infer<typeof sgOverviewSchema>;

export const watchedStudentSchema = z.object({
  student: z.object({
    student_id: z.string(),
    identifier: z.string(),
    name: z.string(),
    line: lineSummarySchema.nullable(),
    stop_name: z.string().nullable(),
    pickup_time: clockTimeSchema.nullable(),
  }),
  status: z.enum(WATCHED_STATUSES),
  boarded_at: isoDateTime().nullable(),
  checked_out_at: isoDateTime().nullable(),
  /** Why they left the bus, in the request's language. */
  checkout_reason: z.string().nullable(),
  added_at: isoDateTime(),
});
export type WatchedStudent = z.infer<typeof watchedStudentSchema>;

export const watchlistSchema = z.object({
  date: z.iso.date(),
  /** Most recently added first. */
  items: z.array(watchedStudentSchema),
  max: z.number().int().positive(),
});
export type Watchlist = z.infer<typeof watchlistSchema>;

export const watchBodySchema = z.object({
  identifier: z.string().trim().min(1).max(IDENTIFIER_MAX_LENGTH),
});

export const watchParamsSchema = z.object({ student_id: z.string().min(1) });
