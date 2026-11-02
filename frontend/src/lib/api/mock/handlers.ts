/**
 * Loads every feature's mock handlers. Imported lazily, only in mock mode, so none of the
 * mock data ends up in the production bundle when the app talks to the real server.
 * Add one import line per feature that has a mock.ts.
 */
import "@/features/announcements/mock";
import "@/features/auth/mock";
import "@/features/card/mock";
import "@/features/lines/mock";
import "@/features/notifications/mock";
import "@/features/payments/mock";
import "@/features/requests/mock";
import "@/features/subscriptions/mock";
import "@/features/system/mock";
import "@/features/trips/mock";
