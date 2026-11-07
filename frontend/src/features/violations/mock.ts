import { MOCK_ACCOUNTS } from "@/features/auth/mock-accounts";
import { mockRidersOf, requireMockCrew } from "@/features/crew/mock-state";
import { localized } from "@/features/lines/mock-builders";
import { newMockId } from "@/features/subscriptions/mock-state";
import { MockHttpError, registerMock } from "@/lib/api/mock/mock-server";
import { MockStorage, StoredMap } from "@/lib/api/mock/stored-map";
import { Role } from "@/lib/auth/roles";
import { createViolationEndpoint, listMyViolationsEndpoint } from "./api";
import { ViolationErrorCode, ViolationStatus, type ConductRule, type Violation } from "./schema";

const HTTP_NOT_FOUND = 404;
/** Mock only: Student Affairs opens a new violation this long after it arrives. */
const MOCK_REVIEW_MS = 60_000;

interface MockViolation {
  violationId: string;
  rule: ConductRule;
  student: { studentId: string; nameAr: string; nameEn: string; identifier: string } | null;
  tripId: string | null;
  description: string;
  photoName: string;
  createdAt: number;
}

/** Each crew member's violations, newest last. The photos themselves aren't kept in the mock. */
const violations = new StoredMap<MockViolation[]>("sut.mock.violations", MockStorage.Local);

function toViolation(item: MockViolation, language: string, now: number): Violation {
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
    status:
      now - item.createdAt >= MOCK_REVIEW_MS
        ? ViolationStatus.UnderReview
        : ViolationStatus.Submitted,
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
    description: body.description,
    photoName: body.photo.file_name,
    createdAt: now,
  };
  violations.set(account.user.id, [...(violations.get(account.user.id) ?? []), item]);
  return toViolation(item, language, now);
});

registerMock(listMyViolationsEndpoint, (_input, { token, language }) => {
  const { account } = requireMockCrew(token);
  const now = Date.now();
  const items = [...(violations.get(account.user.id) ?? [])]
    .reverse()
    .map((item) => toViolation(item, language, now));
  return { items };
});

/** Test helper. */
export function resetViolationsMock(): void {
  violations.clear();
}
