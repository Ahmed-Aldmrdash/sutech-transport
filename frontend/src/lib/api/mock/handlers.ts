/**
 * Loads every feature's mock handlers. Imported lazily, only in mock mode, so none of the
 * mock data ends up in the production bundle when the app talks to the real server.
 * Add one import line per feature that has a mock.ts.
 */
import "@/features/system/mock";
