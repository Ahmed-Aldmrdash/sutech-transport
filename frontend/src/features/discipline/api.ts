import { callEndpoint, type RequestOptions } from "@/lib/api/client";
import { HttpMethod, defineEndpoint } from "@/lib/api/endpoint";
import { Role } from "@/lib/auth/roles";
import {
  createDisciplineBodySchema,
  liftDisciplineBodySchema,
  recordParamsSchema,
  studentParamsSchema,
  studentStandingSchema,
  type CreateDisciplineBody,
  type LiftDisciplineBody,
  type StudentStanding,
} from "./schema";

const TAG = "discipline";
/** The offices that warn, suspend and ban students (the super admin too). */
const DISCIPLINE_OFFICES = [Role.Transport, Role.StudentAffairs, Role.SuperAdmin];

export const getMyStandingEndpoint = defineEndpoint({
  id: "discipline.mine",
  method: HttpMethod.Get,
  path: "/discipline/me",
  summary:
    "The student's own standing (good, warned, suspended, banned) with their warnings, " +
    "suspensions and bans, newest first. Shown on the home page.",
  tag: TAG,
  access: [Role.Student],
  response: studentStandingSchema,
});

export const getStudentStandingEndpoint = defineEndpoint({
  id: "discipline.list",
  method: HttpMethod.Get,
  path: "/admin/students/{student_id}/discipline",
  summary: "A student's standing and every warning, suspension and ban on file, newest first.",
  tag: TAG,
  access: DISCIPLINE_OFFICES,
  params: studentParamsSchema,
  response: studentStandingSchema,
});

export const createDisciplineEndpoint = defineEndpoint({
  id: "discipline.create",
  method: HttpMethod.Post,
  path: "/admin/students/{student_id}/discipline",
  summary:
    "Warns, suspends (until ends_on) or bans a student, with a reason the student and their " +
    "guardians are notified of. A suspension or ban takes effect today: the crew's scan " +
    "answers STUDENT_SUSPENDED / STUDENT_BANNED and the student shows as suspended on the " +
    "trip (never absent); a banned student can't book (STUDENT_BANNED on POST /subscriptions). " +
    "Their seat is kept. Logged in the audit log. Errors: STUDENT_NOT_FOUND (404), " +
    "INVALID_SUSPENSION (422), ALREADY_BANNED (409).",
  tag: TAG,
  access: DISCIPLINE_OFFICES,
  idempotent: true,
  params: studentParamsSchema,
  body: createDisciplineBodySchema,
  response: studentStandingSchema,
});

export const liftDisciplineEndpoint = defineEndpoint({
  id: "discipline.lift",
  method: HttpMethod.Post,
  path: "/admin/discipline/{record_id}/lift",
  summary:
    "Ends a suspension or a ban early, with a note. The student and guardians are told. " +
    "Errors: NOT_LIFTABLE (409, a warning), ALREADY_LIFTED (409).",
  tag: TAG,
  access: DISCIPLINE_OFFICES,
  idempotent: true,
  params: recordParamsSchema,
  body: liftDisciplineBodySchema,
  response: studentStandingSchema,
});

export function getMyStanding(options?: RequestOptions): Promise<StudentStanding> {
  return callEndpoint(getMyStandingEndpoint, {}, options);
}

export function getStudentStanding(
  studentId: string,
  options?: RequestOptions,
): Promise<StudentStanding> {
  return callEndpoint(getStudentStandingEndpoint, { params: { student_id: studentId } }, options);
}

export function createDiscipline(
  studentId: string,
  body: CreateDisciplineBody,
  options?: RequestOptions,
): Promise<StudentStanding> {
  return callEndpoint(
    createDisciplineEndpoint,
    { params: { student_id: studentId }, body },
    options,
  );
}

export function liftDiscipline(
  recordId: string,
  body: LiftDisciplineBody,
  options?: RequestOptions,
): Promise<StudentStanding> {
  return callEndpoint(liftDisciplineEndpoint, { params: { record_id: recordId }, body }, options);
}

export const disciplineEndpoints = [
  getMyStandingEndpoint,
  getStudentStandingEndpoint,
  createDisciplineEndpoint,
  liftDisciplineEndpoint,
];
