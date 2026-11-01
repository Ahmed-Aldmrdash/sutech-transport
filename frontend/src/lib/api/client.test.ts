import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { getHealth } from "@/features/system/api";
import { callEndpoint } from "./client";
import { HttpMethod, buildPath, buildQueryString, defineEndpoint } from "./endpoint";
import { ClientErrorCode, ServerErrorCode, isApiError } from "./errors";
import { MockHttpError, registerMock } from "./mock/mock-server";
import { tokenStore } from "./token-store";

const HTTP_CONFLICT = 409;

const echoEndpoint = defineEndpoint({
  id: "test.echo",
  method: HttpMethod.Post,
  path: "/test/{item_id}",
  summary: "Test only",
  tag: "test",
  access: [],
  params: z.object({ item_id: z.string() }),
  body: z.object({ amount_piasters: z.number().int().nonnegative() }),
  response: z.object({
    item_id: z.string(),
    amount_piasters: z.number(),
    token: z.string().nullable(),
  }),
});

const brokenEndpoint = defineEndpoint({
  id: "test.broken",
  method: HttpMethod.Get,
  path: "/test/broken",
  summary: "Test only",
  tag: "test",
  access: "public",
  response: z.object({ count: z.number() }),
});

const conflictEndpoint = defineEndpoint({
  id: "test.conflict",
  method: HttpMethod.Get,
  path: "/test/conflict",
  summary: "Test only",
  tag: "test",
  access: "public",
  response: z.object({}),
});

registerMock(echoEndpoint, ({ params, body }, { token }) => ({
  item_id: params.item_id,
  amount_piasters: body.amount_piasters,
  token,
}));
// Deliberately wrong shape, to prove responses are validated even in mock mode.
registerMock(brokenEndpoint, () => ({ count: "three" }) as unknown as { count: number });
registerMock(conflictEndpoint, () => {
  throw new MockHttpError(
    HTTP_CONFLICT,
    ServerErrorCode.Conflict,
    "Receipt reference already used",
  );
});

async function expectApiError(promise: Promise<unknown>, code: string, status?: number) {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(isApiError(error)).toBe(true);
  if (!isApiError(error)) return;
  expect(error.code).toBe(code);
  if (status !== undefined) expect(error.status).toBe(status);
}

describe("callEndpoint (mock mode)", () => {
  afterEach(() => tokenStore.clear());

  it("returns a validated health response", async () => {
    const health = await getHealth();
    expect(health.status).toBe("ok");
    expect(() => new Date(health.server_time).toISOString()).not.toThrow();
  });

  it("passes params, body and the bearer token", async () => {
    tokenStore.set("abc");
    const result = await callEndpoint(echoEndpoint, {
      params: { item_id: "7" },
      body: { amount_piasters: 150_000 },
    });
    expect(result).toEqual({ item_id: "7", amount_piasters: 150_000, token: "abc" });
  });

  it("rejects an invalid request before sending it", async () => {
    await expectApiError(
      callEndpoint(echoEndpoint, { params: { item_id: "7" }, body: { amount_piasters: -1 } }),
      ClientErrorCode.InvalidRequest,
    );
  });

  it("rejects a response that doesn't match the schema", async () => {
    await expectApiError(callEndpoint(brokenEndpoint, {}), ClientErrorCode.InvalidResponse);
  });

  it("maps server errors to ApiError with the server's code", async () => {
    await expectApiError(
      callEndpoint(conflictEndpoint, {}),
      ServerErrorCode.Conflict,
      HTTP_CONFLICT,
    );
  });
});

describe("path helpers", () => {
  it("fills and encodes path parameters", () => {
    expect(buildPath("/lines/{line_id}/stops", { line_id: "a b" })).toBe("/lines/a%20b/stops");
  });

  it("fails loudly on a missing parameter", () => {
    expect(() => buildPath("/lines/{line_id}", {})).toThrow(/line_id/);
  });

  it("builds query strings and skips empty values", () => {
    expect(buildQueryString({ page: 2, status: undefined, ids: ["1", "2"] })).toBe(
      "?page=2&ids=1&ids=2",
    );
    expect(buildQueryString({})).toBe("");
  });
});
