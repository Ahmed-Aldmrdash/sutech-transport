"use client";

import { useAsync } from "@/lib/hooks/use-async";
import { getBookingWindow } from "../api";

/** The term's booking window, for the student's lines pages. */
export function useBookingWindow() {
  return useAsync((signal) => getBookingWindow({ signal }), []);
}
