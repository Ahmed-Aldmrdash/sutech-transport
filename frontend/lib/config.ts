export type ApiMode = "mock" | "live";

/** "mock" runs the in-browser mock server (lib/mock). "live" talks to the FastAPI server. */
export const API_MODE: ApiMode = process.env.NEXT_PUBLIC_API_MODE === "live" ? "live" : "mock";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
export const API_PREFIX = "/api/v1";
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "";

export const isMockMode = API_MODE === "mock";

/**
 * Where students send InstaPay / bank transfers. Finance must confirm the real values before launch;
 * the defaults are demo placeholders and only show in mock mode.
 */
export const PAYMENT_DETAILS = {
  instapay: process.env.NEXT_PUBLIC_INSTAPAY_ADDRESS ?? (isMockMode ? "sutech.transport@instapay" : ""),
  bank: process.env.NEXT_PUBLIC_BANK_ACCOUNT ?? (isMockMode ? "0000 0000 0000 0000" : ""),
};
