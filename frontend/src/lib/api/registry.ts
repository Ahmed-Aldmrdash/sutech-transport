import { authEndpoints } from "@/features/auth/api";
import { systemEndpoints } from "@/features/system/api";
import type { Endpoint } from "./endpoint";

/**
 * Every endpoint in the app, used by `npm run openapi`. Add each feature's list here.
 * A test fails if two endpoints share an id or a method + path.
 */
export const allEndpoints: readonly Endpoint[] = [...authEndpoints, ...systemEndpoints];
