import { callEndpoint, type RequestOptions } from "@/lib/api/client";
import { HttpMethod, defineEndpoint } from "@/lib/api/endpoint";
import { Role } from "@/lib/auth/roles";
import { studentCardSchema, type StudentCard } from "./schema";

export const getMyCardEndpoint = defineEndpoint({
  id: "card.getMine",
  method: HttpMethod.Get,
  path: "/card/me",
  summary:
    "The active subscriber's digital pass with a fresh signed QR token (valid 30 seconds). " +
    "The app calls it again just before the token expires. Errors: NOT_SUBSCRIBED (403).",
  tag: "card",
  access: [Role.Student],
  response: studentCardSchema,
});

export function getMyCard(options?: RequestOptions): Promise<StudentCard> {
  return callEndpoint(getMyCardEndpoint, {}, options);
}

export const cardEndpoints = [getMyCardEndpoint];
