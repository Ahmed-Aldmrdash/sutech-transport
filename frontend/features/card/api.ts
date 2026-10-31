import { call } from "@/lib/api/client";
import { defineEndpoint } from "@/lib/api/endpoint";
import { Role } from "@/features/auth/roles";
import { DigitalCard } from "./schema";

export const endpoints = {
  mine: defineEndpoint({
    tag: "card",
    method: "GET",
    path: "/card/me",
    summary: "Digital card with a signed QR that expires after 30 seconds. Active subscribers only.",
    roles: [Role.Student],
    response: DigitalCard,
  }),
};

export const getMyCard = () => call(endpoints.mine);
