import { z } from "zod";
import { isoDateTime } from "@/lib/api/iso-datetime";
import { busTypeSchema, geoPointSchema, lineSummarySchema } from "@/features/lines/schema";
import { SOS_STATUSES, SosAction, sosSchema } from "@/features/sos/schema";
import { TripDirection } from "@/features/trips/schema";

/**
 * The office side of an emergency (agreement, "Emergencies (SOS)"): the Transportation office
 * and the clinic take the alert, log what they do, and close it with a summary. The
 * Transportation office can also send another bus or driver to the trip.
 */

/** What the office logs by hand. `replacement_sent` is logged by the replacement itself. */
export const OFFICE_SOS_ACTIONS = [
  SosAction.Acknowledge,
  SosAction.AmbulanceCalled,
  SosAction.Note,
  SosAction.Close,
] as const;
export type OfficeSosAction = (typeof OFFICE_SOS_ACTIONS)[number];

export const SOS_ACTION_NOTE_MAX_LENGTH = 500;

export const EmergencyErrorCode = {
  /** Someone already took this alert. */
  AlreadyAcknowledged: "ALREADY_ACKNOWLEDGED",
  /** Take the alert first; then log what is done. */
  NotAcknowledged: "SOS_NOT_ACKNOWLEDGED",
  /** The alert is closed; nothing more can be logged. */
  SosClosed: "SOS_CLOSED",
  /** A note, or the summary when closing, is required. */
  NoteRequired: "NOTE_REQUIRED",
  TripAlreadyEnded: "TRIP_ALREADY_ENDED",
  BusNotAvailable: "BUS_NOT_AVAILABLE",
  DriverNotAvailable: "DRIVER_NOT_AVAILABLE",
  /** The chosen bus and driver are the ones already on the trip. */
  NothingToChange: "NOTHING_TO_CHANGE",
} as const;
export type EmergencyErrorCode = (typeof EmergencyErrorCode)[keyof typeof EmergencyErrorCode];

export const ReplacementReason = {
  Breakdown: "breakdown",
  Accident: "accident",
  DriverUnavailable: "driver_unavailable",
  Other: "other",
} as const;
export type ReplacementReason = (typeof ReplacementReason)[keyof typeof ReplacementReason];
export const REPLACEMENT_REASONS = Object.values(ReplacementReason) as [
  ReplacementReason,
  ...ReplacementReason[],
];

export const fleetDriverSchema = z.object({
  driver_id: z.string(),
  name: z.string(),
  phone: z.string(),
});
export type FleetDriver = z.infer<typeof fleetDriverSchema>;

export const fleetBusSchema = z.object({
  bus_id: z.string(),
  bus_type: busTypeSchema,
  plate: z.string(),
  seats: z.number().int().positive(),
});
export type FleetBus = z.infer<typeof fleetBusSchema>;

/** One change of bus or driver on a trip, logged with who and when. */
export const tripReplacementSchema = z.object({
  replacement_id: z.string(),
  bus: fleetBusSchema,
  driver: fleetDriverSchema,
  reason: z.enum(REPLACEMENT_REASONS),
  note: z.string().nullable(),
  sos_id: z.string().nullable(),
  by_name: z.string().nullable(),
  at: isoDateTime(),
});
export type TripReplacement = z.infer<typeof tripReplacementSchema>;

/** An alert as the office sees it: who to call, which bus, and what changed. */
export const adminSosSchema = sosSchema.extend({
  line: lineSummarySchema,
  direction: z.enum([TripDirection.Outbound, TripDirection.Return]),
  /** The bus and driver on the trip now (after any replacement). */
  bus: fleetBusSchema,
  driver: fleetDriverSchema,
  /** The phone of the crew member who raised it, to call back. */
  raised_by_phone: z.string().nullable(),
  /** Bus or driver changes on this trip, oldest first. */
  replacements: z.array(tripReplacementSchema),
  /** For the map, next to the bus. */
  campus_location: geoPointSchema,
});
export type AdminSos = z.infer<typeof adminSosSchema>;

export const adminSosListQuerySchema = z.object({
  status: z.enum(SOS_STATUSES).optional(),
});
export const adminSosListSchema = z.object({ items: z.array(adminSosSchema) });
export type AdminSosList = z.infer<typeof adminSosListSchema>;

export const sosActionBodySchema = z
  .object({
    action: z.enum(OFFICE_SOS_ACTIONS),
    note: z.string().trim().max(SOS_ACTION_NOTE_MAX_LENGTH).nullable(),
  })
  .refine(
    (body) => !(body.action === SosAction.Note || body.action === SosAction.Close) || !!body.note,
    { message: "A note or a summary is required.", path: ["note"] },
  );
export type SosActionBody = z.infer<typeof sosActionBodySchema>;

export const adminSosParamsSchema = z.object({ sos_id: z.string().min(1) });
export const tripParamsSchema = z.object({ trip_id: z.string().min(1) });

/** What the office can send: the trip's bus and driver now, and who is free at the garage. */
export const replacementOptionsSchema = z.object({
  trip_id: z.string(),
  line: lineSummarySchema,
  bus: fleetBusSchema,
  driver: fleetDriverSchema,
  /** Riders on the trip (not counting "not going"), to check the new bus has the seats. */
  riders: z.number().int().nonnegative(),
  /** Free buses, each with the driver who comes with it. */
  buses: z.array(fleetBusSchema.extend({ driver: fleetDriverSchema })),
  /** Free drivers with no bus, for when only the driver changes. */
  drivers: z.array(fleetDriverSchema),
});
export type ReplacementOptions = z.infer<typeof replacementOptionsSchema>;

export const replacementBodySchema = z
  .object({
    /** Another bus (it comes with its own driver unless driver_id says otherwise). */
    bus_id: z.string().min(1).nullable(),
    /** Another driver, on the trip's bus or on the new one. */
    driver_id: z.string().min(1).nullable(),
    reason: z.enum(REPLACEMENT_REASONS),
    note: z.string().trim().max(SOS_ACTION_NOTE_MAX_LENGTH).nullable(),
    /** The alert this answers; it gets a `replacement_sent` line in its log. */
    sos_id: z.string().min(1).nullable(),
  })
  .refine((body) => body.bus_id !== null || body.driver_id !== null, {
    message: "Pick a bus or a driver.",
    path: ["bus_id"],
  });
export type ReplacementBody = z.infer<typeof replacementBodySchema>;
