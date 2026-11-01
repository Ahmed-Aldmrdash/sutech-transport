import { z } from "zod";
import { API_PREFIX, type Endpoint } from "./endpoint";
import { apiErrorBodySchema } from "./errors";
import { allEndpoints } from "./registry";

type JsonSchema = Record<string, unknown>;

interface Operation {
  operationId: string;
  summary: string;
  tags: string[];
  "x-roles": readonly string[] | "public";
  security?: Array<Record<string, string[]>>;
  parameters?: JsonSchema[];
  requestBody?: JsonSchema;
  responses: Record<string, JsonSchema>;
}

export interface OpenApiDocument {
  openapi: string;
  info: { title: string; version: string; description: string };
  servers: Array<{ url: string }>;
  components: JsonSchema;
  paths: Record<string, Record<string, Operation>>;
}

function toJsonSchema(schema: z.ZodType, io: "input" | "output"): JsonSchema {
  return z.toJSONSchema(schema, { io, unrepresentable: "any" }) as JsonSchema;
}

function objectParameters(schema: z.ZodType | undefined, location: "path" | "query"): JsonSchema[] {
  if (!schema) return [];
  const json = toJsonSchema(schema, "input");
  const properties = (json.properties ?? {}) as Record<string, JsonSchema>;
  const required = new Set((json.required ?? []) as string[]);
  return Object.entries(properties).map(([name, propertySchema]) => ({
    name,
    in: location,
    required: location === "path" || required.has(name),
    schema: propertySchema,
  }));
}

function toOperation(endpoint: Endpoint): Operation {
  const errorResponse = { $ref: "#/components/responses/Error" };
  const operation: Operation = {
    operationId: endpoint.id,
    summary: endpoint.summary,
    tags: [endpoint.tag],
    "x-roles": endpoint.access,
    parameters: [
      ...objectParameters(endpoint.params, "path"),
      ...objectParameters(endpoint.query, "query"),
    ],
    responses: {
      "200": {
        description: "OK",
        content: { "application/json": { schema: toJsonSchema(endpoint.response, "output") } },
      },
      default: errorResponse,
    },
  };
  if (endpoint.access !== "public") operation.security = [{ bearerAuth: [] }];
  if (endpoint.body) {
    operation.requestBody = {
      required: true,
      content: { "application/json": { schema: toJsonSchema(endpoint.body, "input") } },
    };
  }
  return operation;
}

export function buildOpenApiDocument(
  endpoints: readonly Endpoint[] = allEndpoints,
): OpenApiDocument {
  const paths: OpenApiDocument["paths"] = {};
  for (const endpoint of endpoints) {
    const route = `${API_PREFIX}${endpoint.path}`;
    paths[route] ??= {};
    paths[route][endpoint.method.toLowerCase()] = toOperation(endpoint);
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "SUtech Transport API",
      version: "0.1.0",
      description:
        "Generated from the front end's Zod schemas (npm run openapi). Fields are snake_case, " +
        "times are ISO 8601 UTC, money is integer piasters, errors are { code, message }.",
    },
    servers: [{ url: "http://localhost:8000" }],
    components: {
      securitySchemes: { bearerAuth: { type: "http", scheme: "bearer" } },
      responses: {
        Error: {
          description: "Any error",
          content: { "application/json": { schema: toJsonSchema(apiErrorBodySchema, "output") } },
        },
      },
    },
    paths,
  };
}
