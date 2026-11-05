import { findMockAccountById, type MockAccount } from "@/features/auth/mock-accounts";
import { requireMockAccount } from "@/features/auth/mock-token";
import { bookingOf } from "@/features/subscriptions/mock-state";
import { SubscriptionStatus } from "@/features/subscriptions/schema";
import { ServerErrorCode } from "@/lib/api/errors";
import { MockHttpError } from "@/lib/api/mock/mock-server";
import { Role } from "@/lib/auth/roles";
import { ChildErrorCode } from "./schema";

/**
 * Which students each guardian account follows. On the real server this comes from the
 * university's records (the guardian's registered phone on the student's file).
 */
const GUARDIAN_CHILDREN: Readonly<Record<string, readonly string[]>> = {
  usr_parent_1: ["usr_student_1", "usr_student_11"],
};

export function mockChildrenOf(guardianId: string): MockAccount[] {
  return (GUARDIAN_CHILDREN[guardianId] ?? [])
    .map((id) => findMockAccountById(id))
    .filter((child): child is MockAccount => child !== undefined);
}

export function isMockGuardianOf(guardianId: string, studentId: string): boolean {
  return (GUARDIAN_CHILDREN[guardianId] ?? []).includes(studentId);
}

/** True when one of the mock guardian accounts follows this student. */
export function hasMockGuardianAccount(studentId: string): boolean {
  return Object.values(GUARDIAN_CHILDREN).some((children) => children.includes(studentId));
}

/** The line the student rides now, or null without an active subscription. */
export function activeLineOf(studentId: string): string | null {
  const booking = bookingOf(studentId);
  return booking?.status === SubscriptionStatus.Active ? booking.lineId : null;
}

/**
 * True when the caller rides this line or follows a child who does: they may see the driver's
 * mobile. Everyone else sees the driver's name only.
 */
export function mayCallDriverOf(account: MockAccount, lineId: string): boolean {
  if (account.user.role === Role.Student) return activeLineOf(account.user.id) === lineId;
  if (account.user.role === Role.Parent) {
    return mockChildrenOf(account.user.id).some((child) => activeLineOf(child.user.id) === lineId);
  }
  return false;
}

const HTTP_FORBIDDEN = 403;

/** The signed-in guardian and one of their children, or 403 like the real server. */
export function requireMockGuardianOf(
  token: string | null,
  studentId: string,
): { guardian: MockAccount; child: MockAccount } {
  const guardian = requireMockAccount(token);
  if (guardian.user.role !== Role.Parent) {
    throw new MockHttpError(HTTP_FORBIDDEN, ServerErrorCode.Forbidden, "Guardians only.");
  }
  const child = findMockAccountById(studentId);
  if (!child || !isMockGuardianOf(guardian.user.id, studentId)) {
    throw new MockHttpError(HTTP_FORBIDDEN, ChildErrorCode.NotYourChild, "Not your child.");
  }
  return { guardian, child };
}

/** The signed-in guardian, or 403. */
export function requireMockGuardian(token: string | null): MockAccount {
  const guardian = requireMockAccount(token);
  if (guardian.user.role !== Role.Parent) {
    throw new MockHttpError(HTTP_FORBIDDEN, ServerErrorCode.Forbidden, "Guardians only.");
  }
  return guardian;
}
