import { MOCK_GUARDIAN_AUTO_APPROVE_MS, type MockRequest } from "./mock-state";
import { RequestStatus } from "./schema";

/**
 * Where a mock request stands at a given time: the guardian's answer, when the office got it,
 * and its status. Pure functions on the stored request, shared by the requests mock, the
 * office's request desk and the mocks that follow a decision (e.g. the line a student rides on
 * a given day).
 */

/** The guardian's answer, if any: recorded, or the mock's stand-in for a guardian with no account. */
export function guardianAnswerOf(
  request: MockRequest,
  now: number,
): { at: number; approved: boolean; note: string | null } | null {
  const step = request.guardian;
  if (!step) return null;
  if (step.decidedAt !== null) {
    return { at: step.decidedAt, approved: step.approved, note: step.note };
  }
  const autoAt = request.submittedAt + MOCK_GUARDIAN_AUTO_APPROVE_MS;
  if (!step.hasAccount && now >= autoAt) {
    return { at: autoAt, approved: true, note: null };
  }
  return null;
}

/** When the office got the request: on sending, or once the guardian approved. Null: not yet. */
export function officeStartOf(request: MockRequest, now: number): number | null {
  if (!request.guardian) return request.submittedAt;
  const answer = guardianAnswerOf(request, now);
  return answer?.approved ? answer.at : null;
}

export function statusAt(request: MockRequest, now: number): RequestStatus {
  if (request.withdrawnAt !== null) return RequestStatus.Withdrawn;
  if (request.guardian) {
    const answer = guardianAnswerOf(request, now);
    if (!answer) return RequestStatus.AwaitingGuardian;
    if (!answer.approved) return RequestStatus.Rejected;
  }
  const office = request.office;
  if (office?.decision && office.decidedAt !== null) return office.decision;
  if (office) return RequestStatus.InReview;
  return RequestStatus.Submitted;
}
