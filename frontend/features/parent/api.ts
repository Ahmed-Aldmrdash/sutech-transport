import { z } from "zod";
import { call } from "@/lib/api/client";
import { defineEndpoint } from "@/lib/api/endpoint";
import { Role } from "@/features/auth/roles";
import { DayRecord } from "@/features/attendance/schema";
import { RequestList } from "@/features/requests/schema";
import { Child } from "./schema";

const PARENT = [Role.Parent] as const;

export const endpoints = {
  children: defineEndpoint({
    tag: "parent",
    method: "GET",
    path: "/parent/children",
    summary: "The children linked to this parent.",
    roles: PARENT,
    response: z.array(Child),
  }),
  timeline: defineEndpoint({
    tag: "parent",
    method: "GET",
    path: "/parent/children/{student_id}/timeline",
    summary: "The child's day (query: date). Only children linked to the parent.",
    roles: PARENT,
    response: DayRecord,
  }),
  requests: defineEndpoint({
    tag: "parent",
    method: "GET",
    path: "/parent/requests",
    summary: "The children's requests, including those waiting for the parent's decision.",
    roles: PARENT,
    response: RequestList,
  }),
};

export const listChildren = () => call(endpoints.children);
export const getChildDay = (studentId: string, date: string) =>
  call(endpoints.timeline, { params: { student_id: studentId }, query: { date } });
export const listChildrenRequests = () => call(endpoints.requests);
