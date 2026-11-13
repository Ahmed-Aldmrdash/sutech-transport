import { z } from "zod";
import { isoDateTime } from "@/lib/api/iso-datetime";
import { Role } from "@/lib/auth/roles";

/**
 * Emergencies from the bus (agreement, "Emergencies (SOS)"). The driver or supervisor picks
 * the type; the server adds the bus's position from the GPS device installed in the bus (not
 * the phone) and alerts the Transportation office at once, and the clinic for medical cases
 * and accidents.
 */
export const SosType = {
  /** Someone on board needs a doctor. Goes to Transport and the clinic. */
  Medical: "medical",
  /** The bus has a problem: a short delay or a replacement bus. Goes to Transport. */
  Breakdown: "breakdown",
  /** A real accident: ambulance if anyone is hurt, a replacement bus to finish the trip. */
  Accident: "accident",
} as const;
export type SosType = (typeof SosType)[keyof typeof SosType];
export const SOS_TYPES = [SosType.Medical, SosType.Breakdown, SosType.Accident] as const;

/** open → acknowledged → closed. Only an admin closes it, with what was done. */
export const SosStatus = {
  Open: "open",
  Acknowledged: "acknowledged",
  Closed: "closed",
} as const;
export type SosStatus = (typeof SosStatus)[keyof typeof SosStatus];
export const SOS_STATUSES = [SosStatus.Open, SosStatus.Acknowledged, SosStatus.Closed] as const;

/** What the office did, logged with who and when. The log can't be edited or deleted. */
export const SosAction = {
  Acknowledge: "acknowledge",
  AmbulanceCalled: "ambulance_called",
  ReplacementSent: "replacement_sent",
  Note: "note",
  Close: "close",
} as const;
export type SosAction = (typeof SosAction)[keyof typeof SosAction];
const SOS_ACTIONS = Object.values(SosAction) as [SosAction, ...SosAction[]];

export const SosErrorCode = {
  /** The trip isn't today's trip of the caller's bus. */
  NotYourTrip: "NOT_YOUR_TRIP",
  /** The trip ended; call the Transportation office. */
  TripAlreadyEnded: "TRIP_ALREADY_ENDED",
} as const;

export const SOS_NOTE_MAX_LENGTH = 300;

/** Where the bus was when the SOS was raised: the latest fix of its GPS device. */
const sosLocationSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  fix_at: isoDateTime(),
  source: z.literal("bus_gps"),
});

export const sosActionEntrySchema = z.object({
  action: z.enum(SOS_ACTIONS),
  /** User id of the office member. */
  by: z.string(),
  /** Their name in the request's language, so the crew sees who took it. */
  by_name: z.string().nullable(),
  at: isoDateTime(),
  note: z.string().nullable(),
});
export type SosActionEntry = z.infer<typeof sosActionEntrySchema>;

export const sosSchema = z.object({
  id: z.string(),
  type: z.enum(SOS_TYPES),
  status: z.enum(SOS_STATUSES),
  note: z.string().nullable(),
  trip_id: z.string(),
  line_id: z.string(),
  bus_id: z.string(),
  raised_by: z.object({
    id: z.string(),
    role: z.enum([Role.Driver, Role.Supervisor]),
    name: z.string(),
  }),
  /** null if the bus's GPS device hasn't reported on this trip. */
  location: sosLocationSchema.nullable(),
  riders_on_board: z.number().int().nonnegative(),
  created_at: isoDateTime(),
  /** Oldest first. */
  actions: z.array(sosActionEntrySchema),
});
export type Sos = z.infer<typeof sosSchema>;

export const createSosBodySchema = z.object({
  trip_id: z.string().min(1),
  type: z.enum(SOS_TYPES),
  note: z.string().trim().max(SOS_NOTE_MAX_LENGTH).nullable(),
});
export type CreateSosBody = z.infer<typeof createSosBodySchema>;

export const sosParamsSchema = z.object({ sos_id: z.string().min(1) });

/** The latest SOS on a trip, carried on the crew's trip so every crew page can show it. */
export const sosSummarySchema = sosSchema.pick({
  id: true,
  type: true,
  status: true,
  created_at: true,
});
