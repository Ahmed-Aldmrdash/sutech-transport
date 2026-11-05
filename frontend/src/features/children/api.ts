import { callEndpoint, type RequestOptions } from "@/lib/api/client";
import { HttpMethod, defineEndpoint } from "@/lib/api/endpoint";
import { Role } from "@/lib/auth/roles";
import {
  childDaySchema,
  childParamsSchema,
  childrenListSchema,
  type ChildDay,
  type ChildrenList,
} from "./schema";

const TAG = "parent";

export const listChildrenEndpoint = defineEndpoint({
  id: "parent.listChildren",
  method: HttpMethod.Get,
  path: "/parent/children",
  summary:
    "The students linked to this guardian (by the guardian's phone on the student's file), " +
    "with each one's booking this term. Names follow Accept-Language.",
  tag: TAG,
  access: [Role.Parent],
  response: childrenListSchema,
});

export const getChildDayEndpoint = defineEndpoint({
  id: "parent.getChildDay",
  method: HttpMethod.Get,
  path: "/parent/children/{student_id}/day",
  summary:
    "Today for one child: where they are in the trip to campus (from the bus scans and its " +
    "GPS), what happened so far, the bus and driver, and the last few days. Changes arrive " +
    "live as `child.day` events (the app re-reads every 30 s until the WebSocket is in place). " +
    "Errors: NOT_YOUR_CHILD (403).",
  tag: TAG,
  access: [Role.Parent],
  params: childParamsSchema,
  response: childDaySchema,
});

export function listChildren(options?: RequestOptions): Promise<ChildrenList> {
  return callEndpoint(listChildrenEndpoint, {}, options);
}

export function getChildDay(studentId: string, options?: RequestOptions): Promise<ChildDay> {
  return callEndpoint(getChildDayEndpoint, { params: { student_id: studentId } }, options);
}

export const childrenEndpoints = [listChildrenEndpoint, getChildDayEndpoint];
