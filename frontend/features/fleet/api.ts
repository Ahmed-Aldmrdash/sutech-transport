import { z } from "zod";
import { call } from "@/lib/api/client";
import { defineEndpoint } from "@/lib/api/endpoint";
import { Role } from "@/features/auth/roles";
import { Line } from "@/features/lines/schema";
import { Bus, BusInput, LinePrice, NewLine, NewStop, StopToggle } from "./schema";

const OPERATIONS = [Role.SuperAdmin, Role.TransportAdmin] as const;

export const endpoints = {
  buses: defineEndpoint({
    tag: "fleet",
    method: "GET",
    path: "/admin/buses",
    summary: "All buses, their driver, line and status.",
    roles: OPERATIONS,
    response: z.array(Bus),
  }),
  createBus: defineEndpoint({
    tag: "fleet",
    method: "POST",
    path: "/admin/buses",
    summary: "Add a bus.",
    roles: OPERATIONS,
    body: BusInput,
    response: Bus,
    idempotent: true,
  }),
  updateBus: defineEndpoint({
    tag: "fleet",
    method: "PUT",
    path: "/admin/buses/{bus_id}",
    summary: "Edit a bus. If it serves a line, the line's students are told about a plate or driver change.",
    roles: OPERATIONS,
    body: BusInput,
    response: Bus,
  }),
  createLine: defineEndpoint({
    tag: "fleet",
    method: "POST",
    path: "/admin/lines",
    summary: "Create a line on a free bus. The university gate is added as the last stop.",
    roles: OPERATIONS,
    body: NewLine,
    response: Line,
    idempotent: true,
  }),
  setPrice: defineEndpoint({
    tag: "fleet",
    method: "PATCH",
    path: "/admin/lines/{line_id}",
    summary: "Change the term price for new bookings (existing bookings keep their price).",
    roles: OPERATIONS,
    body: LinePrice,
    response: Line,
  }),
  addStop: defineEndpoint({
    tag: "fleet",
    method: "POST",
    path: "/admin/lines/{line_id}/stops",
    summary: "Add a stop before the university gate.",
    roles: OPERATIONS,
    body: NewStop,
    response: Line,
  }),
  toggleStop: defineEndpoint({
    tag: "fleet",
    method: "PATCH",
    path: "/admin/lines/{line_id}/stops/{stop_id}",
    summary: "Turn a stop on or off. A stop with booked students can't be turned off.",
    roles: OPERATIONS,
    body: StopToggle,
    response: Line,
  }),
};

export const listBuses = () => call(endpoints.buses);
export const createBus = (body: z.infer<typeof BusInput>) => call(endpoints.createBus, { body });
export const updateBus = (id: string, body: z.infer<typeof BusInput>) =>
  call(endpoints.updateBus, { params: { bus_id: id }, body });
export const createLine = (body: z.infer<typeof NewLine>) => call(endpoints.createLine, { body });
export const setLinePrice = (lineId: string, price: number) =>
  call(endpoints.setPrice, { params: { line_id: lineId }, body: { price } });
export const addStop = (lineId: string, name: string, time: string) =>
  call(endpoints.addStop, { params: { line_id: lineId }, body: { name, time } });
export const toggleStop = (lineId: string, stopId: string, active: boolean) =>
  call(endpoints.toggleStop, { params: { line_id: lineId, stop_id: stopId }, body: { active } });
