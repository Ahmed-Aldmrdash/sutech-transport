import { z } from "zod";
import { IsoDate, IsoDateTime } from "@/lib/api/common";

export const DigitalCard = z.object({
  student_id: z.string(),
  name: z.string(),
  faculty: z.string(),
  level: z.string(),
  line_name: z.string(),
  stop_name: z.string(),
  term_name: z.string(),
  valid_until: IsoDate,
  /** Signed, short-lived token the crew scans. Refresh before qr_expires_at. */
  qr_token: z.string(),
  qr_expires_at: IsoDateTime,
});
export type DigitalCard = z.infer<typeof DigitalCard>;
