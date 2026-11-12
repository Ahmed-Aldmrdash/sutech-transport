import { MOCK_ACCOUNTS } from "@/features/auth/mock-accounts";
import { mockRidersOf, requireMockCrew } from "@/features/crew/mock-state";
import { localized } from "@/features/lines/mock-builders";
import { newMockId } from "@/features/subscriptions/mock-state";
import { MockHttpError, registerMock } from "@/lib/api/mock/mock-server";
import { Role } from "@/lib/auth/roles";
import { createViolationEndpoint, listMyViolationsEndpoint } from "./api";
import { saveViolations, violationsOf, type MockViolation } from "./mock-state";
import { ViolationErrorCode, ViolationStatus, type Violation } from "./schema";

const HTTP_NOT_FOUND = 404;

/** Sent until Student Affairs opens it, then under review, then closed with its decision. */
export function violationStatusOf(item: MockViolation): ViolationStatus {
  if (!item.office) return ViolationStatus.Submitted;
  return item.office.closedAt === null ? ViolationStatus.UnderReview : ViolationStatus.Closed;
}

export function toViolation(item: MockViolation, language: string): Violation {
  return {
    violation_id: item.violationId,
    rule: item.rule,
    student: item.student
      ? {
          student_id: item.student.studentId,
          name: localized(language, item.student.nameAr, item.student.nameEn),
          identifier: item.student.identifier,
        }
      : null,
    trip_id: item.tripId,
    description: item.description,
    photo_name: item.photoName,
    status: violationStatusOf(item),
    created_at: new Date(item.createdAt).toISOString(),
  };
}

registerMock(createViolationEndpoint, ({ body }, { token, language }) => {
  const { account, line } = requireMockCrew(token);
  const now = Date.now();
  let student: MockViolation["student"] = null;
  if (body.student_identifier) {
    const typed = body.student_identifier.toUpperCase();
    const rider = mockRidersOf(line).find((item) => item.identifier === typed);
    const other = MOCK_ACCOUNTS.find(
      ({ user }) => user.role === Role.Student && user.identifier === typed,
    )?.user;
    if (rider) {
      student = {
        studentId: rider.studentId,
        nameAr: rider.nameAr,
        nameEn: rider.nameEn,
        identifier: rider.identifier,
      };
    } else if (other) {
      student = {
        studentId: other.id,
        nameAr: other.name_ar ?? other.name,
        nameEn: other.name,
        identifier: other.identifier,
      };
    } else {
      throw new MockHttpError(
        HTTP_NOT_FOUND,
        ViolationErrorCode.StudentNotFound,
        "No such student.",
      );
    }
  }
  const item: MockViolation = {
    violationId: newMockId("vio"),
    rule: body.rule,
    student,
    tripId: body.trip_id,
    lineId: line.lineId,
    description: body.description,
    photoName: body.photo.file_name,
    createdAt: now,
  };
  saveViolations(account.user.id, [...violationsOf(account.user.id), item]);
  return toViolation(item, language);
});

registerMock(listMyViolationsEndpoint, (_input, { token, language }) => {
  const { account } = requireMockCrew(token);
  const items = [...violationsOf(account.user.id)]
    .reverse()
    .map((item) => toViolation(item, language));
  return { items };
});
