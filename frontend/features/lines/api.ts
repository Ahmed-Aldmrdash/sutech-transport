import { call } from "@/lib/api/client";
import { defineEndpoint } from "@/lib/api/endpoint";
import { ALL_ROLES } from "@/features/auth/roles";
import { Line, LineList } from "./schema";

export const endpoints = {
  list: defineEndpoint({
    tag: "lines",
    method: "GET",
    path: "/lines",
    summary: "All lines with stops, times, price and free seats.",
    roles: ALL_ROLES,
    response: LineList,
  }),
  get: defineEndpoint({
    tag: "lines",
    method: "GET",
    path: "/lines/{line_id}",
    summary: "One line.",
    roles: ALL_ROLES,
    response: Line,
  }),
};

export const listLines = () => call(endpoints.list);
export const getLine = (lineId: string) => call(endpoints.get, { params: { line_id: lineId } });

export function bookableStops(line: Line) {
  return line.stops.filter((stop) => stop.active && !stop.is_destination);
}
