import { call } from "@/lib/api/client";
import { Ok } from "@/lib/api/common";
import { defineEndpoint } from "@/lib/api/endpoint";
import { ALL_ROLES } from "./roles";
import { LoginRequest, LoginResponse, Me, OtpChallenge, OtpRequest } from "./schema";

export const endpoints = {
  requestOtp: defineEndpoint({
    tag: "auth",
    method: "POST",
    path: "/auth/otp",
    summary: "Send a one-time code to the phone registered for a student ID, staff ID or parent phone.",
    roles: "public",
    body: OtpRequest,
    response: OtpChallenge,
  }),
  login: defineEndpoint({
    tag: "auth",
    method: "POST",
    path: "/auth/login",
    summary: "Exchange the identifier and the one-time code for a bearer token that carries the role.",
    roles: "public",
    body: LoginRequest,
    response: LoginResponse,
  }),
  me: defineEndpoint({
    tag: "auth",
    method: "GET",
    path: "/me",
    summary: "The signed-in account and its role.",
    roles: ALL_ROLES,
    response: Me,
  }),
  logout: defineEndpoint({
    tag: "auth",
    method: "POST",
    path: "/auth/logout",
    summary: "Revoke the current token.",
    roles: ALL_ROLES,
    response: Ok,
  }),
};

export const requestOtp = (identifier: string) => call(endpoints.requestOtp, { body: { identifier } });
export const login = (identifier: string, code: string) => call(endpoints.login, { body: { identifier, code } });
export const getMe = () => call(endpoints.me);
export const logout = () => call(endpoints.logout);
