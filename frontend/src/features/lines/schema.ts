import { z } from "zod";

/** Kinds of bus the university runs (Abu El Hol fleet). */
export const BusType = {
  /** Toyota Hiace class, about 14 seats. */
  Minibus: "minibus",
  /** Coaster class, about 28 seats. */
  Coaster: "coaster",
  /** MCV mid-size, about 33 seats. */
  Midibus: "midibus",
  /** Full-size bus, about 50 seats. */
  LargeBus: "large_bus",
} as const;
export type BusType = (typeof BusType)[keyof typeof BusType];
export const busTypeSchema = z.enum([
  BusType.Minibus,
  BusType.Coaster,
  BusType.Midibus,
  BusType.LargeBus,
]);

/**
 * A time of day on the timetable, in Cairo time, "HH:MM" (24h). Timetable times are not
 * instants, so they don't follow the ISO-UTC rule used for timestamps.
 */
export const clockTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

/** When buses reach campus in the morning (Cairo time). Today every line: 08:45 to 09:00. */
export const arrivalWindowSchema = z.object({
  from: clockTimeSchema,
  to: clockTimeSchema,
});

export const geoPointSchema = z.object({ lat: z.number(), lng: z.number() });

/** Names come in the language the request asked for (Accept-Language). */
export const lineSummarySchema = z.object({
  line_id: z.string(),
  /** The university's line number, e.g. "5" or "14-2". */
  code: z.string(),
  name: z.string(),
});
export type LineSummary = z.infer<typeof lineSummarySchema>;

export const lineSchema = lineSummarySchema.extend({
  /** The name in both languages whatever the request's language, so search finds either. */
  name_ar: z.string(),
  name_en: z.string(),
  /** Price of one term on this line, in piasters (1,500,000 = 15,000 EGP). */
  price_piasters: z.number().int().nonnegative(),
  bus_type: busTypeSchema,
  seats_total: z.number().int().nonnegative(),
  seats_available: z.number().int().nonnegative(),
  stop_count: z.number().int().nonnegative(),
  first_pickup_time: clockTimeSchema.nullable(),
  campus_arrival: arrivalWindowSchema,
  /** Afternoon departure from campus. null until the Transportation office publishes it. */
  return_departure_time: clockTimeSchema.nullable(),
});
export type Line = z.infer<typeof lineSchema>;

export const stopSchema = z.object({
  stop_id: z.string(),
  /** 1, 2, 3… in the order the bus passes them. */
  order: z.number().int().positive(),
  name: z.string(),
  /** Landmark or hint from the Transportation office ("In front of Lulu Market"). */
  note: z.string().nullable(),
  pickup_time: clockTimeSchema.nullable(),
  /** Map pin. null until the office sends the real locations. */
  location: geoPointSchema.nullable(),
});
export type Stop = z.infer<typeof stopSchema>;

/** The line's regular driver. The mobile goes only to the line's own subscribers and guardians. */
const driverSchema = z.object({
  name: z.string(),
  /** null when the caller isn't subscribed on this line. */
  phone: z.string().nullable(),
});

/** The bus that runs the line, as registered with the bus company. */
export const busSchema = z.object({
  bus_type: busTypeSchema,
  /** As painted on the bus: Arabic letters, then digits ("ج ص 9943"). */
  plate: z.string(),
  /** null if no driver is assigned yet. */
  driver: driverSchema.nullable(),
});
export type Bus = z.infer<typeof busSchema>;

export const lineDetailSchema = lineSchema.extend({
  bus: busSchema,
  stops: z.array(stopSchema),
});
export type LineDetail = z.infer<typeof lineDetailSchema>;

export const lineParamsSchema = z.object({ line_id: z.string().min(1) });

export const LineErrorCode = { LineNotFound: "LINE_NOT_FOUND" } as const;
