import { adminHandlers } from "./admin";
import { authHandlers } from "./auth";
import { communicationHandlers } from "./communication";
import { crewHandlers } from "./crew";
import { dayHandlers } from "./day";
import { parentHandlers } from "./parent";
import { studentHandlers } from "./student";
import type { Handlers } from "./types";

export const handlers: Handlers = {
  ...authHandlers,
  ...studentHandlers,
  ...dayHandlers,
  ...communicationHandlers,
  ...crewHandlers,
  ...adminHandlers,
  ...parentHandlers,
};
