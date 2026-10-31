/**
 * Writes openapi.json from the front end's endpoint definitions (lib/api/registry.ts), so the Back End team builds
 * exactly what the screens call. Run: npm run openapi
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import type { Endpoint } from "@/lib/api/endpoint";
import { ALL_ENDPOINTS } from "@/lib/api/registry";
import { API_PREFIX } from "@/lib/config";

type Json = Record<string, unknown>;

const ERROR_SCHEMA: Json = {
  type: "object",
  required: ["code", "message"],
  properties: {
    code: { type: "string", description: "Stable machine code the UI translates, e.g. OTP_INVALID, FORBIDDEN." },
    message: { type: "string", description: "Developer message; never shown to users as is." },
  },
};

function schemaOf(type: z.ZodType, io: "input" | "output"): Json {
  const schema = z.toJSONSchema(type, { io, unrepresentable: "any" }) as Json;
  delete schema.$schema;
  return schema;
}

function errorResponse(description: string): Json {
  return { description, content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } };
}

function operation(endpoint: Endpoint): Json {
  const pathParams = [...endpoint.path.matchAll(/\{(\w+)\}/g)].map(([, name]) => ({
    name,
    in: "path",
    required: true,
    schema: { type: "string" },
  }));
  const queryParams = endpoint.query
    ? Object.entries(endpoint.query.shape).map(([name, field]) => ({
        name,
        in: "query",
        required: !(field as z.ZodType).safeParse(undefined).success,
        schema: schemaOf(field as z.ZodType, "input"),
      }))
    : [];
  const headerParams = endpoint.idempotent
    ? [{ name: "Idempotency-Key", in: "header", required: true, schema: { type: "string", format: "uuid" }, description: "Repeat calls with the same key must run once." }]
    : [];
  const isPublic = endpoint.roles === "public";

  return {
    tags: [endpoint.tag],
    summary: endpoint.summary,
    description: isPublic
      ? "Public: no token needed."
      : `Allowed roles: ${(endpoint.roles as readonly string[]).join(", ")}. Every other role gets 403.`,
    "x-roles": endpoint.roles,
    ...(isPublic ? { security: [] } : {}),
    parameters: [...pathParams, ...queryParams, ...headerParams],
    ...(endpoint.body
      ? { requestBody: { required: true, content: { "application/json": { schema: schemaOf(endpoint.body, "input") } } } }
      : {}),
    responses: {
      "200": { description: "OK", content: { "application/json": { schema: schemaOf(endpoint.response, "output") } } },
      "400": errorResponse("Validation or business rule failed"),
      ...(isPublic ? {} : { "401": errorResponse("Missing or expired token"), "403": errorResponse("Role not allowed") }),
      "404": errorResponse("Not found"),
    },
  };
}

function buildDocument(endpoints: Endpoint[]): Json {
  const paths: Record<string, Json> = {};
  for (const endpoint of endpoints) {
    const path = `${API_PREFIX}${endpoint.path}`;
    paths[path] = { ...paths[path], [endpoint.method.toLowerCase()]: operation(endpoint) };
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "SUtech Transport API",
      version: "1.0.0",
      description: "Generated from the front end's endpoint definitions. Times are ISO 8601 with the Africa/Cairo offset; money is whole EGP.",
    },
    servers: [{ url: "/" }],
    security: [{ bearer: [] }],
    paths,
    components: {
      securitySchemes: { bearer: { type: "http", scheme: "bearer" } },
      schemas: { Error: ERROR_SCHEMA },
    },
  };
}

// Mock-only helpers (fake Fawry callback, demo reset) are not part of the real API.
const real = ALL_ENDPOINTS.filter((endpoint) => endpoint.tag !== "mock");
const target = resolve(process.cwd(), "openapi.json");
writeFileSync(target, `${JSON.stringify(buildDocument(real), null, 2)}\n`);
console.log(`openapi.json: ${real.length} endpoints`);
