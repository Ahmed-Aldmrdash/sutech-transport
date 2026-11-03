import { z } from "zod";
import { callEndpoint, type RequestOptions } from "@/lib/api/client";
import { HttpMethod, defineEndpoint } from "@/lib/api/endpoint";
import { ALL_ROLES } from "@/lib/auth/roles";
import {
  lineDetailSchema,
  lineParamsSchema,
  lineSchema,
  type Line,
  type LineDetail,
} from "./schema";

const TAG = "lines";

export const listLinesEndpoint = defineEndpoint({
  id: "lines.list",
  method: HttpMethod.Get,
  path: "/lines",
  summary:
    "Lines open this term, with price, bus type, free seats and the first pickup time. " +
    "Names follow Accept-Language.",
  tag: TAG,
  access: ALL_ROLES,
  response: z.array(lineSchema),
});

export const getLineEndpoint = defineEndpoint({
  id: "lines.get",
  method: HttpMethod.Get,
  path: "/lines/{line_id}",
  summary:
    "One line with its stops in order (name, landmark note, morning pickup time, map pin) and " +
    "its bus and driver. The driver's mobile is filled only for the line's active subscribers " +
    "and their guardians; everyone else gets null. " +
    "Errors: LINE_NOT_FOUND (404).",
  tag: TAG,
  access: ALL_ROLES,
  params: lineParamsSchema,
  response: lineDetailSchema,
});

export function listLines(options?: RequestOptions): Promise<Line[]> {
  return callEndpoint(listLinesEndpoint, {}, options);
}

export function getLine(lineId: string, options?: RequestOptions): Promise<LineDetail> {
  return callEndpoint(getLineEndpoint, { params: { line_id: lineId } }, options);
}

export const linesEndpoints = [listLinesEndpoint, getLineEndpoint];
