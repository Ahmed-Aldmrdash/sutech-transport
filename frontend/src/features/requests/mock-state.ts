import { MockStorage, StoredMap } from "@/lib/api/mock/stored-map";
import type {
  ComplaintCategory,
  LineChangeDuration,
  ModelPurpose,
  RefundReason,
  RequestKind,
  RequestStatus,
} from "./schema";

/**
 * The mock Transportation office's memory of each student's requests, in localStorage so a
 * demo continues where it stopped. Statuses move with time (see MOCK_REQUEST_TIMING), the way
 * an office would pick a request up and answer it. Only the mock uses this.
 */

const MS_PER_SECOND = 1000;

/** Mock only: when the office opens a request, and when it answers. */
export const MOCK_REQUEST_TIMING = {
  /** A guardian with no account in the mock "approves" after this long, so the demo goes on. */
  guardianAutoApproveAfterMs: 20 * MS_PER_SECOND,
  inReviewAfterMs: 15 * MS_PER_SECOND,
  decidedAfterMs: 45 * MS_PER_SECOND,
} as const;

/** What the office will do once it decides. "stays_in_review" = no answer yet (refunds). */
export type MockOutcome =
  | typeof RequestStatus.Approved
  | typeof RequestStatus.Rejected
  | typeof RequestStatus.Resolved
  | "stays_in_review";

export interface MockText {
  ar: string;
  en: string;
}

export interface MockAttachment {
  attachmentId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export interface MockLineChangePayload {
  kind: typeof RequestKind.LineChange;
  fromLineId: string;
  toLineId: string;
  toStopOrder: number;
  duration: LineChangeDuration;
  startsOn: string;
  endsOn: string | null;
  reason: string;
  studentPhone: string;
  guardianName: string;
  guardianPhone: string;
}

export interface MockRefundPayload {
  kind: typeof RequestKind.Refund;
  subscriptionId: string;
  reason: RefundReason;
  explanation: string;
  paidPiasters: number;
  deductionPercent: number;
  estimatedRefundPiasters: number | null;
  guardianName: string;
  guardianPhone: string;
  attachments: MockAttachment[];
}

export interface MockComplaintPayload {
  kind: typeof RequestKind.Complaint;
  category: ComplaintCategory;
  lineId: string | null;
  happenedOn: string;
  description: string;
  attachments: MockAttachment[];
}

export interface MockModelPermitPayload {
  kind: typeof RequestKind.ModelPermit;
  /** The student's details as printed on the permit, kept as they were on the day. */
  student: {
    name: MockText;
    universityId: string;
    faculty: MockText | null;
    level: number | null;
  };
  /** The bus is the student's own line at the time of the request. */
  lineId: string;
  material: string;
  dimensions: string;
  purpose: ModelPurpose;
  purposeOther: string | null;
  destination: string;
  entryDate: string;
  entryTime: string;
  exitDate: string;
  exitTime: string;
  supervisorName: string;
}

export type MockRequestPayload =
  MockLineChangePayload | MockRefundPayload | MockComplaintPayload | MockModelPermitPayload;

/**
 * The guardian's answer to a line change. Requests saved before this step existed have none,
 * and count as already sent to the office.
 */
export interface MockGuardianStep {
  /** False when no guardian account follows the student in the mock (see the auto-approval). */
  hasAccount: boolean;
  decidedAt: number | null;
  approved: boolean;
  note: string | null;
}

export interface MockRequest {
  requestId: string;
  reference: string;
  submittedAt: number;
  withdrawnAt: number | null;
  outcome: MockOutcome;
  /** The office's notes: when it opens the request, and its answer. */
  reviewNote: MockText | null;
  decisionNote: MockText | null;
  /** Set once the decision's effect (e.g. moving the booking) has been applied. */
  appliedAt: number | null;
  /** Set for a line change: it waits for the guardian before the office sees it. */
  guardian?: MockGuardianStep | null;
  payload: MockRequestPayload;
}

const requests = new StoredMap<MockRequest[]>("sut.mock.requests", MockStorage.Local);

/** Seif had a delay on line 7 in October, which the office answered. */
const SEED_REQUESTS: Record<string, MockRequest[]> = {
  usr_student_2: [
    {
      requestId: "req_seed_2",
      reference: "REQ-2026-0017",
      submittedAt: Date.parse("2026-10-14T06:10:00Z"),
      withdrawnAt: null,
      outcome: "resolved",
      reviewNote: null,
      decisionNote: {
        ar:
          "اتكلمنا مع شركة أبو الهول، والتأخير كان بسبب عطل في الباص. اتغير الباص ومن يومها " +
          "الخط بيوصل في ميعاده. متأسفين على التأخير.",
        en:
          "We spoke to Abu El Hol: the delay was a breakdown. The bus was replaced and the line " +
          "has been on time since. Sorry for the delay.",
      },
      appliedAt: null,
      payload: {
        kind: "complaint",
        category: "delay",
        lineId: "ln_07",
        happenedOn: "2026-10-13",
        description: "The bus reached campus at 9:40 and I missed my first lecture.",
        attachments: [],
      },
    },
  ],
};

export function requestsOf(userId: string): MockRequest[] {
  return requests.get(userId) ?? SEED_REQUESTS[userId] ?? [];
}

export function saveRequests(userId: string, list: MockRequest[]): void {
  requests.set(userId, list);
}

/** Request numbers continue from the seeded ones, like a real counter. */
const FIRST_REFERENCE_NUMBER = 42;
const REFERENCE_DIGITS = 4;
const REFERENCE_PATTERN = /^REQ-\d{4}-(\d+)$/;

/**
 * One counter for the whole office, like the server's sequence: two students never get the
 * same number, whoever sends first.
 */
export function nextReference(): string {
  let highest = FIRST_REFERENCE_NUMBER - 1;
  const lists = [...requests.values(), ...Object.values(SEED_REQUESTS)];
  for (const item of lists.flat()) {
    const match = REFERENCE_PATTERN.exec(item.reference);
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  const number = Math.max(highest + 1, FIRST_REFERENCE_NUMBER);
  return `REQ-2026-${String(number).padStart(REFERENCE_DIGITS, "0")}`;
}

/** Test helper: forget every request. */
export function resetRequestsMock(): void {
  requests.clear();
}
