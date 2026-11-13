import type { MockGuardianStep, MockRequest } from "./mock-state";
import { RequestStatus } from "./schema";

/**
 * Where a mock request stands at a given time: the guardian's answer, when the office got it,
 * and its status. Pure functions on the stored request, shared by the requests mock, the
 * office's request desk and the mocks that follow a decision (e.g. the line a student rides on
 * a given day).
 */

/**
 * The guardian step a line change waits on. A guardian with no account can't answer in the
 * app, so nothing waits: the request goes straight to the office, which calls them (agreement,
 * "Office pages update"). Nothing is decided by a timer. An answer already recorded counts.
 */
export function guardianStepOf(request: MockRequest): MockGuardianStep | null {
  const step = request.guardian;
  if (!step) return null;
  return step.hasAccount || step.decidedAt !== null ? step : null;
}

/** The guardian's answer recorded by `now`, if any. */
export function guardianAnswerOf(
  request: MockRequest,
  now: number,
): { at: number; approved: boolean; note: string | null } | null {
  const step = guardianStepOf(request);
  if (!step || step.decidedAt === null || step.decidedAt > now) return null;
  return { at: step.decidedAt, approved: step.approved, note: step.note };
}

/** When the office got the request: on sending, or once the guardian approved. Null: not yet. */
export function officeStartOf(request: MockRequest, now: number): number | null {
  if (!guardianStepOf(request)) return request.submittedAt;
  const answer = guardianAnswerOf(request, now);
  return answer?.approved ? answer.at : null;
}

export function statusAt(request: MockRequest, now: number): RequestStatus {
  if (request.withdrawnAt !== null) return RequestStatus.Withdrawn;
  if (guardianStepOf(request)) {
    const answer = guardianAnswerOf(request, now);
    if (!answer) return RequestStatus.AwaitingGuardian;
    if (!answer.approved) return RequestStatus.Rejected;
  }
  const office = request.office;
  if (office?.decision && office.decidedAt !== null) return office.decision;
  if (office) return RequestStatus.InReview;
  return RequestStatus.Submitted;
}
