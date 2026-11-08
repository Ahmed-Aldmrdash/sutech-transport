import { describe, expect, it } from "vitest";
import { allEndpoints } from "../registry";
import { loadMockFeature } from "./handlers";
import { isMocked } from "./mock-server";
import { MOCK_FEATURE_OF } from "./mock-routing";

describe("mock routing", () => {
  it("knows which feature answers every endpoint", () => {
    const missing = allEndpoints.filter((endpoint) => !(endpoint.id in MOCK_FEATURE_OF));
    expect(missing.map((endpoint) => endpoint.id)).toEqual([]);
  });

  // One at a time, in order: each feature must answer its own endpoints by itself.
  it.each(allEndpoints.map((endpoint) => [endpoint.id] as const))(
    "%s is answered by its feature's mock",
    async (id) => {
      const feature = MOCK_FEATURE_OF[id];
      if (!feature) throw new Error(`no feature for ${id}`);
      await loadMockFeature(feature);
      expect(isMocked(id)).toBe(true);
    },
  );
});
