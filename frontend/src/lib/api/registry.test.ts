import { describe, expect, it } from "vitest";
import { buildOpenApiDocument } from "./openapi";
import { allEndpoints } from "./registry";

describe("endpoint registry", () => {
  it("has unique ids and unique method + path pairs", () => {
    const ids = allEndpoints.map((endpoint) => endpoint.id);
    const routes = allEndpoints.map((endpoint) => `${endpoint.method} ${endpoint.path}`);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(routes).size).toBe(routes.length);
  });

  it("builds an OpenAPI document under /api/v1", () => {
    const document = buildOpenApiDocument();
    expect(document.openapi).toBe("3.1.0");
    expect(document.paths["/api/v1/health"]?.get?.operationId).toBe("system.getHealth");
  });
});

describe("contract rules from the agreement", () => {
  const document = buildOpenApiDocument();
  const operation = (method: string, path: string) =>
    document.paths[`/api/v1${path}`]?.[method] as
      { "x-roles": readonly string[] | "public"; security?: unknown } | undefined;

  it("signs in with an HttpOnly session cookie, never a bearer token", () => {
    const schemes = (document.components as { securitySchemes: Record<string, unknown> })
      .securitySchemes;
    expect(schemes).toEqual({
      sessionCookie: expect.objectContaining({ type: "apiKey", in: "cookie" }),
    });
    const securities = Object.values(document.paths).flatMap((methods) =>
      Object.values(methods).map((item) => JSON.stringify(item.security ?? null)),
    );
    expect(new Set(securities)).toEqual(new Set(["null", '[{"sessionCookie":[]}]']));
    expect(operation("get", "/me")?.security).toEqual([{ sessionCookie: [] }]);
    expect(operation("post", "/auth/otp")?.security).toBeUndefined();
  });

  it("keeps the super admin view-only on SOS, replacement buses and Abu El Hol's portal", () => {
    const actions = [
      ["post", "/admin/sos/{sos_id}/actions"],
      ["get", "/admin/trips/{trip_id}/replacement-options"],
      ["post", "/admin/trips/{trip_id}/replacement"],
      ["post", "/bus-company/requests/{event_id}/reply"],
    ] as const;
    for (const [method, path] of actions) {
      expect(operation(method, path)?.["x-roles"]).not.toContain("super_admin");
    }
    // ...but still reads those desks.
    for (const path of ["/admin/sos", "/admin/sos/{sos_id}", "/bus-company/requests"]) {
      expect(operation("get", path)?.["x-roles"]).toContain("super_admin");
    }
  });
});

describe("openapi.json", () => {
  it("is up to date with the endpoint definitions (run `npm run openapi`)", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const onDisk = readFileSync(path.join(import.meta.dirname, "../../../openapi.json"), "utf8");
    expect(onDisk).toBe(`${JSON.stringify(buildOpenApiDocument(), null, 2)}\n`);
  });
});
