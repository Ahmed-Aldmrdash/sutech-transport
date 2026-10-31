import { call } from "@/lib/api/client";
import { defineEndpoint } from "@/lib/api/endpoint";
import { Role } from "@/features/auth/roles";
import { ChatReply, ChatRequest, type ChatTurn } from "./schema";

export const endpoints = {
  ask: defineEndpoint({
    tag: "chat",
    method: "POST",
    path: "/chat",
    summary: "Ask the transport assistant (built by the AI team).",
    roles: [Role.Student],
    body: ChatRequest,
    response: ChatReply,
  }),
};

export const askAssistant = (message: string, history: ChatTurn[]) =>
  call(endpoints.ask, { body: { message, history: history.slice(-20) } });
