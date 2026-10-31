import type { Ctx } from "../helpers";

export type Handlers = Record<string, (ctx: Ctx) => unknown>;
