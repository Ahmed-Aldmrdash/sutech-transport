import { callEndpoint, type RequestOptions } from "@/lib/api/client";
import { HttpMethod, defineEndpoint } from "@/lib/api/endpoint";
import { healthSchema, type Health } from "./schema";

export const getHealthEndpoint = defineEndpoint({
  id: "system.getHealth",
  method: HttpMethod.Get,
  path: "/health",
  summary: "Server health and current server time (UTC).",
  tag: "system",
  access: "public",
  response: healthSchema,
});

export function getHealth(options?: RequestOptions): Promise<Health> {
  return callEndpoint(getHealthEndpoint, {}, options);
}

export const systemEndpoints = [getHealthEndpoint];
