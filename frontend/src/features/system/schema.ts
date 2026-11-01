import { z } from "zod";

export const ServiceStatus = {
  Ok: "ok",
  Degraded: "degraded",
} as const;

/** GET /api/v1/health: lets the app check that the server is up before a user signs in. */
export const healthSchema = z.object({
  status: z.enum([ServiceStatus.Ok, ServiceStatus.Degraded]),
  version: z.string(),
  server_time: z.iso.datetime(),
});
export type Health = z.infer<typeof healthSchema>;
