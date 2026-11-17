import { callEndpoint, type RequestOptions } from "@/lib/api/client";
import { HttpMethod, defineEndpoint } from "@/lib/api/endpoint";
import { Role } from "@/lib/auth/roles";
import { askBodySchema, assistantAnswerSchema, type AskBody, type AssistantAnswer } from "./schema";

export const askAssistantEndpoint = defineEndpoint({
  id: "assistant.ask",
  method: HttpMethod.Post,
  path: "/assistant/ask",
  summary:
    "The students' assistant (floating button on every student page). Answers from the " +
    "university's transport documents only (price, payment, refunds, conduct rules, " +
    "timetable, requests), in the question's language, with its sources. The AI team's " +
    "service behind one ask_llm layer; the student's own line and subscription may be used " +
    "as context. needs_office=true when it has no answer. Rate limit: 20 questions a minute " +
    "per student (429 RATE_LIMITED).",
  tag: "assistant",
  access: [Role.Student],
  body: askBodySchema,
  response: assistantAnswerSchema,
});

export function askAssistant(body: AskBody, options?: RequestOptions): Promise<AssistantAnswer> {
  return callEndpoint(askAssistantEndpoint, { body }, options);
}

export const assistantEndpoints = [askAssistantEndpoint];
