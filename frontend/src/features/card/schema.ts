import { z } from "zod";
import { isoDateTime } from "@/lib/api/iso-datetime";
import { clockTimeSchema, lineSummarySchema } from "@/features/lines/schema";
import { calendarDateSchema } from "@/features/subscriptions/schema";

export const CardErrorCode = { NotSubscribed: "NOT_SUBSCRIBED" } as const;

/**
 * The code the driver or supervisor scans. Signed by the server and short-lived (30 seconds),
 * so a screenshot can't be shared. The app shows it as a QR code and asks for a new one in time.
 */
const cardQrSchema = z.object({
  token: z.string().min(1),
  expires_at: isoDateTime(),
});

export const studentCardSchema = z.object({
  card_id: z.string(),
  student: z.object({
    name: z.string(),
    identifier: z.string(),
    faculty: z.string().nullable(),
    level: z.number().int().nullable(),
    photo_url: z.url().nullable(),
  }),
  line: lineSummarySchema,
  stop: z.object({ name: z.string(), pickup_time: clockTimeSchema.nullable() }),
  term_name: z.string(),
  valid_until: calendarDateSchema,
  qr: cardQrSchema,
});
export type StudentCard = z.infer<typeof studentCardSchema>;
