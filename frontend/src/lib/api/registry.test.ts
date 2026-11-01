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

describe("openapi.json", () => {
  it("is up to date with the endpoint definitions (run `npm run openapi`)", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const onDisk = readFileSync(path.join(import.meta.dirname, "../../../openapi.json"), "utf8");
    expect(onDisk).toBe(`${JSON.stringify(buildOpenApiDocument(), null, 2)}\n`);
  });
});
