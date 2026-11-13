import { z } from "zod";
import { isoDateTime } from "@/lib/api/iso-datetime";
import { riderCountsSchema, riderSchema } from "@/features/crew/schema";
import { fleetSchema } from "@/features/event-buses/schema";
import {
  busTypeSchema,
  clockTimeSchema,
  geoPointSchema,
  lineSummarySchema,
} from "@/features/lines/schema";
import { RequestKind, requestStatusSchema } from "@/features/requests/schema";
import { sgOverviewSchema } from "@/features/sg-office/schema";
import { SubscriptionStatus } from "@/features/subscriptions/schema";

/**
 * The Transportation office's own operations pages: the day at a glance with what waits for
 * the office, every bus on one map, the lines and their students, who rode, the students, and
 * the buses and drivers. All read-only except changing a trip's bus or driver, which reuses
 * the emergencies desk's replacement.
 */

const count = z.number().int().nonnegative();

export const OpsErrorCode = {
  /** The day is in the future or more than 31 days back. */
  DateInvalid: "DATE_INVALID",
  LineNotFound: "LINE_NOT_FOUND",
  StudentNotFound: "STUDENT_NOT_FOUND",
} as const;

export const opsDayQuerySchema = z.object({ date: z.iso.date().optional() });
export type OpsDayQuery = z.input<typeof opsDayQuerySchema>;

// ---------------------------------------------------------------------------------------------
// Overview

export const opsOverviewSchema = sgOverviewSchema.extend({
  /** What waits for the Transportation office now (whatever the day shown). */
  queues: z.object({
    emergencies_open: count,
    /** Line changes and model permits not opened yet. */
    requests_new: count,
    complaints_new: count,
    /** Event requests Abu El Hol hasn't answered. */
    events_waiting: count,
  }),
});
export type OpsOverview = z.infer<typeof opsOverviewSchema>;

// ---------------------------------------------------------------------------------------------
// Live map

export const LiveBusStatus = {
  NotStarted: "not_started",
  OnTheRoad: "on_the_road",
  Arrived: "arrived",
  NoService: "no_service",
} as const;
export type LiveBusStatus = (typeof LiveBusStatus)[keyof typeof LiveBusStatus];
const LIVE_BUS_STATUSES = Object.values(LiveBusStatus) as [LiveBusStatus, ...LiveBusStatus[]];

export const liveBusSchema = z.object({
  line: lineSummarySchema,
  /** Today's morning trip, for changing its bus or driver. null on a day with no buses. */
  trip_id: z.string().nullable(),
  bus: z.object({
    plate: z.string(),
    bus_type: busTypeSchema,
    driver_name: z.string(),
    driver_phone: z.string(),
  }),
  replaced: z.boolean(),
  status: z.enum(LIVE_BUS_STATUSES),
  /** Latest GPS fix while on the road. */
  position: geoPointSchema
    .extend({
      heading: z.number().min(0).max(360).nullable(),
      speed_kmh: z.number().nonnegative(),
      recorded_at: isoDateTime(),
    })
    .nullable(),
  /** The last stop the bus passed. */
  near_stop: z.string().nullable(),
  /** Share of the trip done, 0 to 1. */
  progress: z.number().min(0).max(1),
  leaves_at: clockTimeSchema.nullable(),
  subscribers: count,
  rode: count,
  delay_minutes: z.number().int().positive().nullable(),
  /** An SOS from this trip is still open. */
  sos_open: z.boolean(),
});
export type LiveBus = z.infer<typeof liveBusSchema>;

export const liveBusesSchema = z.object({
  generated_at: isoDateTime(),
  campus_location: geoPointSchema,
  items: z.array(liveBusSchema),
});
export type LiveBuses = z.infer<typeof liveBusesSchema>;

// ---------------------------------------------------------------------------------------------
// Lines

const opsBusSchema = z.object({
  plate: z.string(),
  bus_type: busTypeSchema,
  seats: count,
  driver_name: z.string(),
  driver_phone: z.string(),
});

export const opsLineSchema = z.object({
  line: lineSummarySchema,
  /** The line's own bus and driver (today's, after any replacement, are on the live map). */
  bus: opsBusSchema,
  stops: count,
  first_pickup: clockTimeSchema.nullable(),
  subscribers: count,
  /** Bookings waiting for payment, holding a seat. */
  reserved: count,
  seats_free: count,
});
export type OpsLine = z.infer<typeof opsLineSchema>;

export const opsLinesSchema = z.object({
  items: z.array(opsLineSchema),
  totals: z.object({ lines: count, seats: count, subscribers: count, seats_free: count }),
});
export type OpsLines = z.infer<typeof opsLinesSchema>;

export const opsLineParamsSchema = z.object({ line_id: z.string().min(1) });

export const opsLineDetailSchema = opsLineSchema.extend({
  stops_list: z.array(
    z.object({
      order: z.number().int().positive(),
      name: z.string(),
      pickup_time: clockTimeSchema.nullable(),
      subscribers: count,
    }),
  ),
  /** The line's subscribers, by stop. */
  students: z.array(
    z.object({
      student_id: z.string(),
      identifier: z.string(),
      name: z.string(),
      stop_order: z.number().int().positive(),
      stop_name: z.string(),
      pickup_time: clockTimeSchema.nullable(),
    }),
  ),
  /** Today's morning trip, for changing its bus or driver. null on a day with no buses. */
  today_trip_id: z.string().nullable(),
});
export type OpsLineDetail = z.infer<typeof opsLineDetailSchema>;

// ---------------------------------------------------------------------------------------------
// Attendance

export const attendanceQuerySchema = z.object({
  line_id: z.string().min(1),
  date: z.iso.date().optional(),
});
export type AttendanceQuery = z.input<typeof attendanceQuerySchema>;

export const lineAttendanceSchema = z.object({
  date: z.iso.date(),
  line: lineSummarySchema,
  is_service_day: z.boolean(),
  /** The morning trip: not started, on the road, or ended. null on a day with no buses. */
  trip_status: z.enum(["not_started", "in_progress", "ended"]).nullable(),
  counts: riderCountsSchema,
  riders: z.array(riderSchema),
});
export type LineAttendance = z.infer<typeof lineAttendanceSchema>;

// ---------------------------------------------------------------------------------------------
// Students

const SUBSCRIPTION_STATUSES = Object.values(SubscriptionStatus) as [
  SubscriptionStatus,
  ...SubscriptionStatus[],
];

export const studentsQuerySchema = z.object({
  q: z.string().trim().max(60).optional(),
  line_id: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
});
export type StudentsQuery = z.input<typeof studentsQuerySchema>;

export const opsStudentSchema = z.object({
  student_id: z.string(),
  identifier: z.string(),
  name: z.string(),
  line: lineSummarySchema.nullable(),
  stop_name: z.string().nullable(),
  subscription_status: z.enum(SUBSCRIPTION_STATUSES).nullable(),
});
export type OpsStudent = z.infer<typeof opsStudentSchema>;

export const STUDENTS_PAGE_SIZE = 25;

export const opsStudentsSchema = z.object({
  items: z.array(opsStudentSchema),
  total: count,
  page: z.number().int().positive(),
  page_size: z.number().int().positive(),
});
export type OpsStudents = z.infer<typeof opsStudentsSchema>;

export const opsStudentParamsSchema = z.object({ student_id: z.string().min(1) });

const REQUEST_KIND_VALUES = Object.values(RequestKind) as [RequestKind, ...RequestKind[]];

export const opsStudentDetailSchema = opsStudentSchema.extend({
  faculty: z.string().nullable(),
  level: z.number().int().positive().nullable(),
  phone: z.string().nullable(),
  pickup_time: clockTimeSchema.nullable(),
  guardian: z
    .object({ name: z.string(), phone: z.string().nullable(), has_account: z.boolean() })
    .nullable(),
  /** This term's morning trips so far. */
  trips: z.object({ rode: count, not_going: count, absent: count }),
  requests: z.array(
    z.object({
      request_id: z.string(),
      reference: z.string(),
      kind: z.enum(REQUEST_KIND_VALUES),
      status: requestStatusSchema,
      received_at: isoDateTime(),
      /** The Transportation office handles it, so the link opens its desk. */
      handled_here: z.boolean(),
    }),
  ),
});
export type OpsStudentDetail = z.infer<typeof opsStudentDetailSchema>;

// ---------------------------------------------------------------------------------------------
// Buses and drivers

export const opsFleetSchema = fleetSchema.extend({
  /** Today's morning trip per line, for changing a line's bus or driver. */
  trips: z.array(z.object({ line_id: z.string(), trip_id: z.string() })),
});
export type OpsFleet = z.infer<typeof opsFleetSchema>;
