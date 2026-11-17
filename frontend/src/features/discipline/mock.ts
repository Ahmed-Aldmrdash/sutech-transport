import { recordAudit, studentTarget } from "@/features/admin-system/mock-log";
import { AuditAction } from "@/features/admin-system/schema";
import { findMockAccountById } from "@/features/auth/mock-accounts";
import { requireMockOffice } from "@/features/auth/mock-token";
import { mockRidersOf } from "@/features/crew/mock-state";
import { localized } from "@/features/lines/mock-builders";
import { MOCK_LINES } from "@/features/lines/mock-lines";
import { requireMockStudent } from "@/features/subscriptions/mock";
import { mockStudentRecords } from "@/features/subscriptions/mock-desk-students";
import { newMockId } from "@/features/subscriptions/mock-state";
import { addDays, cairoNow } from "@/lib/api/mock/cairo-clock";
import { MockHttpError, registerMock } from "@/lib/api/mock/mock-server";
import { Role } from "@/lib/auth/roles";
import {
  createDisciplineEndpoint,
  getMyStandingEndpoint,
  getStudentStandingEndpoint,
  liftDisciplineEndpoint,
} from "./api";
import {
  disciplineOf,
  findDisciplineRecord,
  isInForce,
  saveDisciplineRecord,
  standingOn,
  type MockDisciplineRecord,
} from "./mock-state";
import {
  DisciplineAction,
  DisciplineErrorCode,
  MAX_SUSPENSION_DAYS,
  Standing,
  type StudentStanding,
} from "./schema";

const HTTP = { NotFound: 404, Conflict: 409, Unprocessable: 422 };
const OFFICES = [Role.Transport, Role.StudentAffairs];

const AUDIT_OF = {
  [DisciplineAction.Warning]: AuditAction.StudentWarned,
  [DisciplineAction.Suspension]: AuditAction.StudentSuspended,
  [DisciplineAction.Ban]: AuditAction.StudentBanned,
} as const;

/** Any student the offices can open: a known record or a rider on a line. */
export function findMockStudent(studentId: string) {
  const known = mockStudentRecords().find((record) => record.id === studentId);
  if (known) return known;
  for (const line of MOCK_LINES) {
    const rider = mockRidersOf(line).find((item) => item.studentId === studentId);
    if (rider)
      return {
        id: rider.studentId,
        nameAr: rider.nameAr,
        nameEn: rider.nameEn,
        identifier: rider.identifier,
      };
  }
  return undefined;
}

function nameOf(userId: string | null, language: string): string | null {
  const user = userId ? findMockAccountById(userId)?.user : undefined;
  return user ? localized(language, user.name_ar ?? user.name, user.name) : null;
}

export function standingOf(studentId: string, language: string, now: number): StudentStanding {
  const today = cairoNow(new Date(now)).date;
  const list = disciplineOf(studentId);
  const standing = standingOn(studentId, today);
  const suspension = list.find(
    (record) => record.action === DisciplineAction.Suspension && isInForce(record, today),
  );
  return {
    standing,
    warnings: list.filter((record) => record.action === DisciplineAction.Warning).length,
    suspended_until: standing === Standing.Suspended ? (suspension?.endsOn ?? null) : null,
    records: list.map((record) => ({
      record_id: record.recordId,
      action: record.action,
      reason: record.reason,
      starts_on: record.startsOn,
      ends_on: record.endsOn,
      in_force: isInForce(record, today),
      by_name: nameOf(record.byId, language) ?? "",
      created_at: new Date(record.createdAt).toISOString(),
      lifted_at: record.liftedAt === null ? null : new Date(record.liftedAt).toISOString(),
      lifted_by_name: nameOf(record.liftedById, language),
      lift_note: record.liftNote,
    })),
  };
}

registerMock(getMyStandingEndpoint, (_input, { token, language }) => {
  const { user } = requireMockStudent(token);
  return standingOf(user.id, language, Date.now());
});

function requireStudent(studentId: string) {
  const student = findMockStudent(studentId);
  if (!student) {
    throw new MockHttpError(HTTP.NotFound, DisciplineErrorCode.StudentNotFound, "No student.");
  }
  return student;
}

registerMock(getStudentStandingEndpoint, ({ params }, { token, language }) => {
  requireMockOffice(token, OFFICES);
  requireStudent(params.student_id);
  return standingOf(params.student_id, language, Date.now());
});

registerMock(createDisciplineEndpoint, ({ params, body }, { token, language }) => {
  const actor = requireMockOffice(token, OFFICES);
  const student = requireStudent(params.student_id);
  const now = Date.now();
  const today = cairoNow(new Date(now)).date;
  let endsOn: string | null = null;
  if (body.action === DisciplineAction.Suspension) {
    const last = addDays(today, MAX_SUSPENSION_DAYS);
    if (!body.ends_on || body.ends_on <= today || body.ends_on > last) {
      throw new MockHttpError(
        HTTP.Unprocessable,
        DisciplineErrorCode.InvalidSuspension,
        "Pick an end day from tomorrow, within 90 days.",
      );
    }
    endsOn = body.ends_on;
  }
  if (body.action === DisciplineAction.Ban && standingOn(student.id, today) === Standing.Banned) {
    throw new MockHttpError(HTTP.Conflict, DisciplineErrorCode.AlreadyBanned, "Already banned.");
  }
  const record: MockDisciplineRecord = {
    recordId: newMockId("dsc"),
    studentId: student.id,
    action: body.action,
    reason: body.reason.trim(),
    startsOn: today,
    endsOn,
    byId: actor.user.id,
    createdAt: now,
    liftedAt: null,
    liftedById: null,
    liftNote: null,
  };
  saveDisciplineRecord(record);
  recordAudit(
    actor,
    AUDIT_OF[body.action],
    studentTarget(student),
    endsOn ? `${record.reason} · → ${endsOn}` : record.reason,
    now,
  );
  return standingOf(student.id, language, now);
});

registerMock(liftDisciplineEndpoint, ({ params, body }, { token, language }) => {
  const actor = requireMockOffice(token, OFFICES);
  const record = findDisciplineRecord(params.record_id);
  if (!record) {
    throw new MockHttpError(HTTP.NotFound, DisciplineErrorCode.StudentNotFound, "No record.");
  }
  if (record.action === DisciplineAction.Warning) {
    throw new MockHttpError(HTTP.Conflict, DisciplineErrorCode.NotLiftable, "Warnings stay.");
  }
  const now = Date.now();
  if (record.liftedAt !== null || !isInForce(record, cairoNow(new Date(now)).date)) {
    throw new MockHttpError(HTTP.Conflict, DisciplineErrorCode.AlreadyLifted, "Not in force.");
  }
  saveDisciplineRecord({
    ...record,
    liftedAt: now,
    liftedById: actor.user.id,
    liftNote: body.note.trim(),
  });
  const student = requireStudent(record.studentId);
  recordAudit(actor, AuditAction.DisciplineLifted, studentTarget(student), body.note.trim(), now);
  return standingOf(record.studentId, language, now);
});
