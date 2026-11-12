import { mockNameOf, requireMockOffice } from "@/features/auth/mock-token";
import type { MockAccount } from "@/features/auth/mock-accounts";
import { findMockLine, localized, toLine, toLineSummary } from "@/features/lines/mock-builders";
import { currentRequestsOf, officeActorOf, toStudentRequest } from "@/features/requests/mock";
import { refundApprovedReply, suggestedReplies } from "@/features/requests/mock-replies";
import {
  requestsOf,
  saveRequests,
  studentsWithRequests,
  type MockOfficeStep,
  type MockRequest,
  type MockText,
} from "@/features/requests/mock-state";
import { officeStartOf, statusAt } from "@/features/requests/mock-status";
import {
  EXCEPTIONAL_REFUND_REASONS,
  RequestActor,
  RequestKind,
  RequestStatus,
} from "@/features/requests/schema";
import { findMockStudentRecord } from "@/features/subscriptions/mock-desk-students";
import { bookingOf, seatsHeldOn } from "@/features/subscriptions/mock-state";
import { ServerErrorCode } from "@/lib/api/errors";
import { MockHttpError, registerMock } from "@/lib/api/mock/mock-server";
import { Role } from "@/lib/auth/roles";
import { actOnDeskRequestEndpoint, getDeskRequestEndpoint, listDeskRequestsEndpoint } from "./api";
import {
  DeskAction,
  DeskErrorCode,
  DeskStage,
  type DeskRequest,
  type DeskRequestSummary,
} from "./schema";

const HTTP = { NotFound: 404, Conflict: 409, Unprocessable: 422 };
const DEFAULT_PAGE_SIZE = 20;
const DESKS = [Role.Transport, Role.Finance];

const iso = (time: number) => new Date(time).toISOString();
const text = (value: MockText | null, language: string) =>
  value ? localized(language, value.ar, value.en) : null;

interface Owned {
  studentId: string;
  request: MockRequest;
  /** When it reached the office. */
  receivedAt: number;
}

/** Finance handles refunds and payment complaints; Transportation the rest. */
function isFor(role: Role, request: MockRequest): boolean {
  if (role === Role.SuperAdmin) return true;
  const office =
    officeActorOf(request.payload) === RequestActor.Finance ? Role.Finance : Role.Transport;
  return office === role;
}

function stageOf(status: RequestStatus): DeskStage {
  if (status === RequestStatus.Submitted) return DeskStage.New;
  if (status === RequestStatus.InReview) return DeskStage.InReview;
  return DeskStage.Closed;
}

/** Every request that reached an office and belongs to the caller's office. */
function visibleRequests(role: Role, now: number): Owned[] {
  return studentsWithRequests().flatMap((studentId) =>
    currentRequestsOf(studentId, now).flatMap((request) => {
      const receivedAt = officeStartOf(request, now);
      if (receivedAt === null || !isFor(role, request)) return [];
      if (request.withdrawnAt !== null && request.withdrawnAt < receivedAt) return [];
      return [{ studentId, request, receivedAt }];
    }),
  );
}

function findOwned(role: Role, requestId: string, now: number): Owned {
  const found = visibleRequests(role, now).find((item) => item.request.requestId === requestId);
  if (!found) throw new MockHttpError(HTTP.NotFound, ServerErrorCode.NotFound, "No such request.");
  return found;
}

const REFUND_TITLE: Record<string, MockText> = {
  standard: { ar: "استرداد عادي", en: "Ordinary refund" },
  medical: { ar: "استرداد لظرف صحي", en: "Medical refund" },
  bereavement: { ar: "استرداد لوفاة في الأسرة", en: "Bereavement refund" },
  transfer: { ar: "استرداد للتحويل لجامعة تانية", en: "Refund for a transfer" },
};

const COMPLAINT_TITLE: Record<string, MockText> = {
  driver_behaviour: { ar: "تصرف السواق", en: "Driver behaviour" },
  delay: { ar: "تأخير", en: "Delay" },
  bus_condition: { ar: "حالة الباص", en: "Bus condition" },
  crowding: { ar: "زحمة في الباص", en: "Crowding" },
  safety: { ar: "الأمان", en: "Safety" },
  payment: { ar: "الدفع", en: "Payment" },
  other: { ar: "حاجة تانية", en: "Other" },
};

function lineCode(lineId: string | null): string | null {
  return lineId ? (findMockLine(lineId)?.code ?? null) : null;
}

/** One line for the queue, in the request's language. */
function titleOf(request: MockRequest, language: string): string {
  const { payload } = request;
  switch (payload.kind) {
    case RequestKind.LineChange: {
      const from = lineCode(payload.fromLineId) ?? "";
      const to = lineCode(payload.toLineId) ?? "";
      return localized(language, `من خط ${from} لخط ${to}`, `Line ${from} → line ${to}`);
    }
    case RequestKind.Refund:
      return text(REFUND_TITLE[payload.reason] ?? null, language) ?? payload.reason;
    case RequestKind.Complaint: {
      const category = text(COMPLAINT_TITLE[payload.category] ?? null, language) ?? "";
      const code = lineCode(payload.lineId);
      if (!code) return category;
      return localized(language, `${category} · خط ${code}`, `${category} · line ${code}`);
    }
    case RequestKind.ModelPermit:
      return localized(
        language,
        `مجسم (${payload.dimensions}) يوم ${payload.entryDate}`,
        `Model (${payload.dimensions}) on ${payload.entryDate}`,
      );
  }
}

function handledBy(request: MockRequest, language: string): string | null {
  const step = request.office;
  if (!step) return null;
  return text(step.decidedBy ?? step.openedBy, language);
}

function updatedAt(owned: Owned): number {
  const step = owned.request.office;
  return Math.max(
    owned.receivedAt,
    step?.openedAt ?? 0,
    step?.decidedAt ?? 0,
    owned.request.withdrawnAt ?? 0,
  );
}

function studentName(studentId: string, language: string) {
  const student = findMockStudentRecord(studentId);
  return {
    name: student ? localized(language, student.nameAr, student.nameEn) : studentId,
    identifier: student?.identifier ?? "",
  };
}

function toSummary(owned: Owned, language: string, now: number): DeskRequestSummary {
  const { request } = owned;
  const status = statusAt(request, now);
  return {
    request_id: request.requestId,
    reference: request.reference,
    kind: request.payload.kind,
    status,
    stage: stageOf(status),
    title: titleOf(request, language),
    student: studentName(owned.studentId, language),
    received_at: iso(owned.receivedAt),
    updated_at: iso(updatedAt(owned)),
    handled_by_name: handledBy(request, language),
  };
}

function allowedActions(request: MockRequest, now: number): DeskAction[] {
  const stage = stageOf(statusAt(request, now));
  if (stage === DeskStage.Closed) return [];
  const open = stage === DeskStage.New ? [DeskAction.Open] : [];
  return request.payload.kind === RequestKind.Complaint
    ? [...open, DeskAction.Resolve]
    : [...open, DeskAction.Approve, DeskAction.Reject];
}

function targetSeats(request: MockRequest, language: string): number | null {
  const { payload } = request;
  if (payload.kind !== RequestKind.LineChange) return null;
  const line = findMockLine(payload.toLineId);
  return line ? toLine(line, language, seatsHeldOn(line.lineId)).seats_available : null;
}

function toDeskRequest(owned: Owned, language: string, now: number): DeskRequest {
  const { request, studentId } = owned;
  const student = findMockStudentRecord(studentId);
  const booking = bookingOf(studentId, now);
  const line = booking ? findMockLine(booking.lineId) : undefined;
  const replies = suggestedReplies(request.payload);
  return {
    request: toStudentRequest(request, language, now),
    stage: stageOf(statusAt(request, now)),
    student: {
      student_id: studentId,
      name: student ? localized(language, student.nameAr, student.nameEn) : studentId,
      identifier: student?.identifier ?? "",
      phone: student?.phone ?? "",
      faculty:
        student?.facultyAr && student.facultyEn
          ? localized(language, student.facultyAr, student.facultyEn)
          : null,
      level: student?.level ?? null,
      line: line ? toLineSummary(line, language) : null,
      subscription_status: booking?.status ?? null,
    },
    allowed_actions: allowedActions(request, now),
    suggested_replies: {
      open: text(replies.open, language),
      approve: text(replies.approve, language),
      reject: text(replies.reject, language),
      resolve: text(replies.resolve, language),
    },
    target_seats_available: targetSeats(request, language),
    handled_by_name: handledBy(request, language),
  };
}

/** Waiting longest at the top; answered ones newest first, at the end. */
function byQueueOrder(a: Owned, b: Owned, now: number): number {
  const order = { [DeskStage.New]: 0, [DeskStage.InReview]: 1, [DeskStage.Closed]: 2 };
  const aStage = stageOf(statusAt(a.request, now));
  const bStage = stageOf(statusAt(b.request, now));
  if (aStage !== bStage) return order[aStage] - order[bStage];
  if (aStage === DeskStage.Closed) return updatedAt(b) - updatedAt(a);
  return a.receivedAt - b.receivedAt;
}

function matchesSearch(owned: Owned, q: string | undefined): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  const student = findMockStudentRecord(owned.studentId);
  return [owned.request.reference, student?.identifier, student?.nameAr, student?.nameEn].some(
    (value) => value?.toLowerCase().includes(needle),
  );
}

registerMock(listDeskRequestsEndpoint, ({ query }, { token, language }) => {
  const { user } = requireMockOffice(token, DESKS);
  const now = Date.now();
  const kinds = query.kind ?? [];
  const scoped = visibleRequests(user.role, now).filter(
    (item) =>
      (kinds.length === 0 || kinds.includes(item.request.payload.kind)) &&
      matchesSearch(item, query.q),
  );
  const counts = { new: 0, in_review: 0, closed: 0 };
  for (const item of scoped) counts[stageOf(statusAt(item.request, now))] += 1;
  const filtered = scoped
    .filter((item) => !query.stage || stageOf(statusAt(item.request, now)) === query.stage)
    .sort((a, b) => byQueueOrder(a, b, now));
  const page = query.page ?? 1;
  const pageSize = query.page_size ?? DEFAULT_PAGE_SIZE;
  return {
    items: filtered
      .slice((page - 1) * pageSize, page * pageSize)
      .map((item) => toSummary(item, language, now)),
    total: filtered.length,
    counts,
  };
});

registerMock(getDeskRequestEndpoint, ({ params }, { token, language }) => {
  const { user } = requireMockOffice(token, DESKS);
  const now = Date.now();
  return toDeskRequest(findOwned(user.role, params.request_id, now), language, now);
});

function unprocessable(code: string, message: string): MockHttpError {
  return new MockHttpError(HTTP.Unprocessable, code, message);
}

/** The refund to approve: the policy's amount, or the office's for an exceptional case. */
function refundToApprove(request: MockRequest, given: number | null): number | null {
  const { payload } = request;
  if (payload.kind !== RequestKind.Refund) return null;
  if (!EXCEPTIONAL_REFUND_REASONS.includes(payload.reason)) {
    return payload.estimatedRefundPiasters ?? 0;
  }
  if (given === null || given > payload.paidPiasters) {
    throw unprocessable(
      DeskErrorCode.RefundAmountInvalid,
      "Give an amount between 0 and what the student paid.",
    );
  }
  return given;
}

function decide(
  officer: MockAccount,
  owned: Owned,
  action: DeskAction,
  note: string,
  refund: number | null,
  now: number,
): MockOfficeStep {
  const { request } = owned;
  const name = mockNameOf(officer);
  const opened: MockOfficeStep = request.office ?? {
    openedAt: now,
    openedBy: name,
    openNote: null,
    decidedAt: null,
    decidedBy: null,
    decision: null,
    note: null,
    refundPiasters: null,
  };
  const words = (value: string): MockText => ({ ar: value, en: value });
  switch (action) {
    case DeskAction.Open:
      return { ...opened, openNote: note ? words(note) : null };
    case DeskAction.Resolve:
      return {
        ...opened,
        decidedAt: now,
        decidedBy: name,
        decision: RequestStatus.Resolved,
        note: words(note),
      };
    case DeskAction.Reject:
      return {
        ...opened,
        decidedAt: now,
        decidedBy: name,
        decision: RequestStatus.Rejected,
        note: words(note),
      };
    case DeskAction.Approve: {
      const amount = refundToApprove(request, refund);
      const reply = note ? words(note) : amount === null ? null : refundApprovedReply(amount);
      return {
        ...opened,
        decidedAt: now,
        decidedBy: name,
        decision: RequestStatus.Approved,
        note: reply,
        refundPiasters: amount,
      };
    }
  }
}

registerMock(actOnDeskRequestEndpoint, ({ params, body }, { token, language }) => {
  const officer = requireMockOffice(token, DESKS);
  const now = Date.now();
  const owned = findOwned(officer.user.role, params.request_id, now);
  const { request } = owned;
  if (stageOf(statusAt(request, now)) === DeskStage.Closed) {
    throw new MockHttpError(HTTP.Conflict, DeskErrorCode.RequestClosed, "Already closed.");
  }
  if (!allowedActions(request, now).includes(body.action)) {
    throw unprocessable(DeskErrorCode.ActionNotAllowed, "Not for this request.");
  }
  const note = body.note?.trim() ?? "";
  const needsNote = body.action === DeskAction.Reject || body.action === DeskAction.Resolve;
  if (needsNote && !note) throw unprocessable(DeskErrorCode.NoteRequired, "Write the answer.");
  if (body.action === DeskAction.Approve) {
    const seats = targetSeats(request, language);
    if (seats === 0) {
      throw new MockHttpError(HTTP.Conflict, DeskErrorCode.SeatUnavailable, "The line is full.");
    }
  }
  const step = decide(officer, owned, body.action, note, body.refund_piasters, now);
  saveRequests(
    owned.studentId,
    requestsOf(owned.studentId).map((item) =>
      item.requestId === request.requestId ? { ...item, office: step } : item,
    ),
  );
  return toDeskRequest(findOwned(officer.user.role, request.requestId, now), language, now);
});
