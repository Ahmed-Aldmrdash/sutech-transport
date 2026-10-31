import { z } from "zod";
import { call } from "@/lib/api/client";
import { defineEndpoint } from "@/lib/api/endpoint";
import { Role } from "@/features/auth/roles";
import { LiveLine, MyTracking } from "./schema";

export const endpoints = {
  mine: defineEndpoint({
    tag: "tracking",
    method: "GET",
    path: "/tracking/me",
    summary: "The student's bus: position from the bus GPS unit, ETA to their stop, delay. Active subscribers only.",
    roles: [Role.Student],
    response: MyTracking,
  }),
  child: defineEndpoint({
    tag: "tracking",
    method: "GET",
    path: "/parent/children/{student_id}/tracking",
    summary: "The child's bus, for the parent.",
    roles: [Role.Parent],
    response: MyTracking,
  }),
  all: defineEndpoint({
    tag: "tracking",
    method: "GET",
    path: "/admin/live",
    summary: "Every line's bus right now, with boarded / expected riders.",
    roles: [Role.SuperAdmin, Role.TransportAdmin],
    response: z.array(LiveLine),
  }),
};

export const getMyTracking = () => call(endpoints.mine);
export const getChildTracking = (studentId: string) =>
  call(endpoints.child, { params: { student_id: studentId } });
export const getLiveLines = () => call(endpoints.all);
