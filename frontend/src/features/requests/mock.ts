import {
  findMockLine,
  localized,
  mockStopId,
  toLine,
  toLineSummary,
} from "@/features/lines/mock-builders";
import { LineErrorCode } from "@/features/lines/schema";
import { PaymentErrorCode, RECEIPT_MAX_BYTES, type ReceiptFile } from "@/features/payments/schema";
import { mockTerm, requireMockStudent } from "@/features/subscriptions/mock";
import {
  MOCK_TERM,
  MockPaymentStatus,
  bookingOf,
  newMockId,
  paymentsOf,
  saveBooking,
  seatsHeldOn,
} from "@/features/subscriptions/mock-state";
import { SubscriptionStatus } from "@/features/subscriptions/schema";
import { ServerErrorCode } from "@/lib/api/errors";
import { MockHttpError, registerMock } from "@/lib/api/mock/mock-server";
import { formatMoney, todayInCairo } from "@/lib/format";
import {
  createComplaintEndpoint,
  createLineChangeEndpoint,
  createModelPermitEndpoint,
  createRefundEndpoint,
  getRefundPolicyEndpoint,
  getRequestEndpoint,
  listMyRequestsEndpoint,
  withdrawRequestEndpoint,
} from "./api";
import {
  MOCK_REQUEST_TIMING,
  nextReference,
  requestsOf,
  saveRequests,
  type MockAttachment,
  type MockRequest,
  type MockRequestPayload,
  type MockText,
} from "./mock-state";
import { deductionOn, isRefundWindowOpen, refundAmount } from "./refund-policy";
import {
  ComplaintCategory,
  EXCEPTIONAL_REFUND_REASONS,
  LineChangeDuration,
  OPEN_REQUEST_STATUSES,
  RequestActor,
  RequestErrorCode,
  RequestKind,
  RequestStatus,
  type RefundWindow,
  type RequestEvent,
  type StudentRequest,
} from "./schema";

const HTTP = { NotFound: 404, Conflict: 409, TooLarge: 413, Unprocessable: 422 };

/** The Fall 2026 refund table (Refund Policy 2026-2027, first semester). */
export const MOCK_REFUND_WINDOWS: readonly RefundWindow[] = [
  { from: "2026-09-20", to: "2026-10-08", deduction_percent: 25 },
  { from: "2026-10-11", to: "2026-10-29", deduction_percent: 50 },
  { from: "2026-11-01", to: null, deduction_percent: 100 },
];
const PAYOUT_DAYS = 45;
const PROCESSING_DAYS = 3;
const TRANSPORT_ROOM = "A039";

const iso = (time: number) => new Date(time).toISOString();

/** Who gives the final answer for each kind. The office always opens the request first. */
const DECIDED_BY: Record<RequestKind, RequestEvent["by"]> = {
  [RequestKind.LineChange]: RequestActor.TransportOffice,
  [RequestKind.Refund]: RequestActor.Finance,
  [RequestKind.Complaint]: RequestActor.TransportOffice,
  [RequestKind.ModelPermit]: RequestActor.Safety,
};

function statusAt(request: MockRequest, now: number): RequestStatus {
  if (request.withdrawnAt !== null) return RequestStatus.Withdrawn;
  const elapsed = now - request.submittedAt;
  if (elapsed < MOCK_REQUEST_TIMING.inReviewAfterMs) return RequestStatus.Submitted;
  if (elapsed < MOCK_REQUEST_TIMING.decidedAfterMs || request.outcome === "stays_in_review") {
    return RequestStatus.InReview;
  }
  return request.outcome;
}

function timelineOf(request: MockRequest, now: number, language: string): RequestEvent[] {
  const note = (text: MockText | null) => (text ? localized(language, text.ar, text.en) : null);
  const office = DECIDED_BY[request.payload.kind];
  const events: RequestEvent[] = [
    {
      status: RequestStatus.Submitted,
      at: iso(request.submittedAt),
      by: RequestActor.Student,
      note: null,
    },
  ];
  if (request.withdrawnAt !== null) {
    events.push({
      status: RequestStatus.Withdrawn,
      at: iso(request.withdrawnAt),
      by: RequestActor.Student,
      note: null,
    });
    return events;
  }
  const status = statusAt(request, now);
  if (status === RequestStatus.Submitted) return events;
  events.push({
    status: RequestStatus.InReview,
    at: iso(request.submittedAt + MOCK_REQUEST_TIMING.inReviewAfterMs),
    by: RequestActor.TransportOffice,
    note: note(request.reviewNote),
  });
  if (status !== RequestStatus.InReview) {
    events.push({
      status,
      at: iso(request.submittedAt + MOCK_REQUEST_TIMING.decidedAfterMs),
      by: office,
      note: note(request.decisionNote),
    });
  }
  return events;
}

function lineSummary(lineId: string, language: string) {
  const line = findMockLine(lineId);
  if (!line) throw new Error(`Unknown mock line ${lineId}`);
  return toLineSummary(line, language);
}

function toAttachments(list: readonly MockAttachment[]) {
  return list.map((item) => ({
    attachment_id: item.attachmentId,
    file_name: item.fileName,
    content_type: item.contentType,
    size_bytes: item.sizeBytes,
  }));
}

function detailsOf(payload: MockRequestPayload, language: string) {
  switch (payload.kind) {
    case RequestKind.LineChange: {
      const line = findMockLine(payload.toLineId);
      const [, nameAr = "", nameEn = ""] = line?.stops[payload.toStopOrder - 1] ?? [];
      return {
        kind: payload.kind,
        details: {
          from_line: lineSummary(payload.fromLineId, language),
          to_line: lineSummary(payload.toLineId, language),
          to_stop: {
            stop_id: mockStopId(payload.toLineId, payload.toStopOrder),
            name: localized(language, nameAr, nameEn),
          },
          duration: payload.duration,
          starts_on: payload.startsOn,
          ends_on: payload.endsOn,
          reason: payload.reason,
          student_phone: payload.studentPhone,
          guardian_name: payload.guardianName,
          guardian_phone: payload.guardianPhone,
        },
      };
    }
    case RequestKind.Refund:
      return {
        kind: payload.kind,
        details: {
          subscription_id: payload.subscriptionId,
          reason: payload.reason,
          explanation: payload.explanation,
          paid_piasters: payload.paidPiasters,
          deduction_percent: payload.deductionPercent,
          estimated_refund_piasters: payload.estimatedRefundPiasters,
          guardian_name: payload.guardianName,
          guardian_phone: payload.guardianPhone,
          attachments: toAttachments(payload.attachments),
        },
      };
    case RequestKind.Complaint:
      return {
        kind: payload.kind,
        details: {
          category: payload.category,
          line: payload.lineId ? lineSummary(payload.lineId, language) : null,
          happened_on: payload.happenedOn,
          description: payload.description,
          attachments: toAttachments(payload.attachments),
        },
      };
    case RequestKind.ModelPermit: {
      const line = findMockLine(payload.lineId);
      if (!line) throw new Error(`Unknown mock line ${payload.lineId}`);
      const { student } = payload;
      return {
        kind: payload.kind,
        details: {
          student_name: localized(language, student.name.ar, student.name.en),
          university_id: student.universityId,
          faculty: student.faculty
            ? localized(language, student.faculty.ar, student.faculty.en)
            : null,
          level: student.level,
          line: toLineSummary(line, language),
          bus_type: line.busType,
          // Driver names and phones are not in the mock on purpose (see mock-lines.ts).
          driver_name: null,
          driver_phone: null,
          material: payload.material,
          dimensions: payload.dimensions,
          purpose: payload.purpose,
          purpose_other: payload.purposeOther,
          destination: payload.destination,
          entry_date: payload.entryDate,
          entry_time: payload.entryTime,
          exit_date: payload.exitDate,
          exit_time: payload.exitTime,
          supervisor_name: payload.supervisorName,
        },
      };
    }
  }
}

export function toStudentRequest(
  request: MockRequest,
  language: string,
  now = Date.now(),
): StudentRequest {
  const timeline = timelineOf(request, now, language);
  return {
    request_id: request.requestId,
    reference: request.reference,
    status: statusAt(request, now),
    submitted_at: iso(request.submittedAt),
    updated_at: timeline.at(-1)?.at ?? iso(request.submittedAt),
    timeline,
    ...detailsOf(request.payload, language),
  } as StudentRequest;
}

/** Applies what an approval changes: a permanent line change moves the booking. */
function applyDecisions(userId: string, list: MockRequest[], now: number): MockRequest[] {
  const today = todayInCairo(new Date(now));
  let changed = false;
  const settled = list.map((request) => {
    if (request.appliedAt !== null || statusAt(request, now) !== RequestStatus.Approved) {
      return request;
    }
    const { payload } = request;
    const booking = bookingOf(userId, now);
    if (payload.kind === RequestKind.LineChange) {
      if (payload.duration !== LineChangeDuration.Permanent || payload.startsOn > today) {
        return request;
      }
      if (booking?.status === SubscriptionStatus.Active) {
        saveBooking(userId, {
          ...booking,
          lineId: payload.toLineId,
          stopOrder: payload.toStopOrder,
        });
      }
    } else if (
      payload.kind === RequestKind.Refund &&
      booking?.status === SubscriptionStatus.Active
    ) {
      saveBooking(userId, {
        ...booking,
        status: SubscriptionStatus.Cancelled,
        holdExpiresAt: null,
      });
    }
    changed = true;
    return { ...request, appliedAt: now };
  });
  if (changed) saveRequests(userId, settled);
  return settled;
}

/** The student's requests with time-based changes applied. Also used by the notifications mock. */
export function currentRequestsOf(userId: string, now = Date.now()): MockRequest[] {
  return applyDecisions(userId, requestsOf(userId), now);
}

function hasOpenRequest(userId: string, kind: RequestKind, now: number): boolean {
  return currentRequestsOf(userId, now).some(
    (request) =>
      request.payload.kind === kind && OPEN_REQUEST_STATUSES.includes(statusAt(request, now)),
  );
}

function requireActiveBooking(userId: string) {
  const booking = bookingOf(userId);
  if (!booking || booking.status !== SubscriptionStatus.Active) {
    throw new MockHttpError(
      HTTP.Conflict,
      RequestErrorCode.NoActiveSubscription,
      "You need an active subscription for this request.",
    );
  }
  return booking;
}

function rejectIfOpen(userId: string, kind: RequestKind, now: number) {
  if (hasOpenRequest(userId, kind, now)) {
    throw new MockHttpError(
      HTTP.Conflict,
      RequestErrorCode.RequestAlreadyOpen,
      "You already have an open request of this kind.",
    );
  }
}

function invalidDates(message: string): MockHttpError {
  return new MockHttpError(HTTP.Unprocessable, RequestErrorCode.InvalidDates, message);
}

/** Decoded size of a base64 file, as the server would measure it. */
function decodedBytes(file: ReceiptFile): number {
  const BASE64_RATIO = 3 / 4;
  return Math.floor(file.data_base64.length * BASE64_RATIO);
}

function storeFiles(files: readonly ReceiptFile[]): MockAttachment[] {
  return files.map((file) => {
    const sizeBytes = decodedBytes(file);
    if (sizeBytes > RECEIPT_MAX_BYTES) {
      throw new MockHttpError(HTTP.TooLarge, PaymentErrorCode.ReceiptTooLarge, "File too large.");
    }
    return {
      attachmentId: newMockId("att"),
      fileName: file.file_name,
      contentType: file.content_type,
      sizeBytes,
    };
  });
}

function addRequest(userId: string, request: Omit<MockRequest, "requestId" | "reference">) {
  const stored: MockRequest = {
    ...request,
    requestId: newMockId("req"),
    reference: nextReference(userId),
  };
  saveRequests(userId, [...requestsOf(userId), stored]);
  return stored;
}

/** Approved refunds are paid in full pounds: the paid amount minus the day's deduction. */
function paidThisTerm(userId: string, subscriptionId: string): number {
  return paymentsOf(userId)
    .filter(
      (payment) =>
        payment.subscriptionId === subscriptionId && payment.status === MockPaymentStatus.Approved,
    )
    .reduce((sum, payment) => sum + payment.amountPiasters, 0);
}

registerMock(listMyRequestsEndpoint, ({ query }, { token, language }) => {
  const { user } = requireMockStudent(token);
  const now = Date.now();
  return currentRequestsOf(user.id, now)
    .filter((request) => !query.kind || request.payload.kind === query.kind)
    .sort((a, b) => b.submittedAt - a.submittedAt || b.reference.localeCompare(a.reference))
    .map((request) => toStudentRequest(request, language, now));
});

registerMock(getRequestEndpoint, ({ params }, { token, language }) => {
  const { user } = requireMockStudent(token);
  const request = currentRequestsOf(user.id).find((item) => item.requestId === params.request_id);
  if (!request)
    throw new MockHttpError(HTTP.NotFound, ServerErrorCode.NotFound, "No such request.");
  return toStudentRequest(request, language);
});

registerMock(createLineChangeEndpoint, ({ body }, { token, language }) => {
  const { user } = requireMockStudent(token);
  const now = Date.now();
  const booking = requireActiveBooking(user.id);
  rejectIfOpen(user.id, RequestKind.LineChange, now);
  if (body.to_line_id === booking.lineId) {
    throw new MockHttpError(HTTP.Unprocessable, RequestErrorCode.SameLine, "That's your line.");
  }
  const line = findMockLine(body.to_line_id);
  if (!line) throw new MockHttpError(HTTP.NotFound, LineErrorCode.LineNotFound, "No such line.");
  const stopIndex = line.stops.findIndex(
    (_stop, index) => mockStopId(line.lineId, index + 1) === body.to_stop_id,
  );
  if (stopIndex < 0) {
    throw new MockHttpError(HTTP.Unprocessable, "STOP_NOT_ON_LINE", "That stop isn't on the line.");
  }
  const today = todayInCairo(new Date(now));
  if (body.starts_on < today) throw invalidDates("The change can't start in the past.");
  if (body.ends_on !== null && body.ends_on < body.starts_on) {
    throw invalidDates("The end date is before the start date.");
  }
  if (body.starts_on > MOCK_TERM.ends_on || (body.ends_on ?? "") > MOCK_TERM.ends_on) {
    throw invalidDates("The dates are after the end of the term.");
  }

  const lineName = localized("en", line.nameAr, line.nameEn);
  const lineNameAr = localized("ar", line.nameAr, line.nameEn);
  const [, stopAr = "", stopEn = ""] = line.stops[stopIndex] ?? [];
  const hasSeat = toLine(line, language, seatsHeldOn(line.lineId)).seats_available > 0;
  const stored = addRequest(user.id, {
    submittedAt: now,
    withdrawnAt: null,
    outcome: hasSeat ? RequestStatus.Approved : RequestStatus.Rejected,
    reviewNote: {
      ar: `استلمنا الاستمارة، وهنكلم ولي الأمر على ${body.guardian_phone} نتأكد من الموافقة.`,
      en: `We got your form and will call your guardian on ${body.guardian_phone} to confirm.`,
    },
    decisionNote: hasSeat
      ? {
          ar:
            `تمت الموافقة. من يوم ${body.starts_on} اركب خط ${line.code} (${lineNameAr}) من ` +
            `محطة ${stopAr}، ووري الكارت للمشرف زي العادي.`,
          en:
            `Approved. From ${body.starts_on}, ride line ${line.code} (${lineName}) from ` +
            `${stopEn}, and show your card to the supervisor as usual.`,
        }
      : {
          ar:
            `للأسف خط ${line.code} مليان دلوقتي ومفيش كرسي فاضي. جرّب خط فيه أماكن، أو ` +
            `كلمنا في مكتب ${TRANSPORT_ROOM}.`,
          en:
            `Sorry, line ${line.code} is full and has no free seat now. Try a line with free ` +
            `seats, or see us at office ${TRANSPORT_ROOM}.`,
        },
    appliedAt: null,
    payload: {
      kind: RequestKind.LineChange,
      fromLineId: booking.lineId,
      toLineId: line.lineId,
      toStopOrder: stopIndex + 1,
      duration: body.duration,
      startsOn: body.starts_on,
      endsOn: body.ends_on,
      reason: body.reason,
      studentPhone: body.student_phone,
      guardianName: body.guardian_name,
      guardianPhone: body.guardian_phone,
    },
  });
  return toStudentRequest(stored, language, now);
});

registerMock(createRefundEndpoint, ({ body }, { token, language }) => {
  const { user } = requireMockStudent(token);
  const now = Date.now();
  const booking = requireActiveBooking(user.id);
  if (booking.subscriptionId !== body.subscription_id) {
    throw new MockHttpError(HTTP.NotFound, ServerErrorCode.NotFound, "No such subscription.");
  }
  rejectIfOpen(user.id, RequestKind.Refund, now);
  const deduction = deductionOn(MOCK_REFUND_WINDOWS, todayInCairo(new Date(now)));
  const isExceptional = EXCEPTIONAL_REFUND_REASONS.includes(body.reason);
  if (!isExceptional && !isRefundWindowOpen(deduction)) {
    throw new MockHttpError(
      HTTP.Unprocessable,
      RequestErrorCode.RefundWindowClosed,
      "Ordinary refunds are closed for this term.",
    );
  }
  if (isExceptional && body.documents.length === 0) {
    throw new MockHttpError(
      HTTP.Unprocessable,
      RequestErrorCode.DocumentsRequired,
      "Attach the supporting document.",
    );
  }
  const paid = paidThisTerm(user.id, booking.subscriptionId);
  const estimate = isExceptional ? null : refundAmount(paid, deduction);
  const stored = addRequest(user.id, {
    submittedAt: now,
    withdrawnAt: null,
    outcome: isExceptional ? "stays_in_review" : RequestStatus.Approved,
    reviewNote: isExceptional
      ? {
          ar:
            `بعتنا المستندات لإدارة الجامعة تقرر. هات أصل إيصال الدفع لمكتب النقل ${TRANSPORT_ROOM}. ` +
            `القرار بياخد حوالي ${PROCESSING_DAYS} أيام عمل.`,
          en:
            `We sent your documents to the university administration to decide. Bring the original ` +
            `payment receipt to the Transportation office, ${TRANSPORT_ROOM}. A decision takes about ` +
            `${PROCESSING_DAYS} working days.`,
        }
      : {
          ar: `هات أصل إيصال الدفع لمكتب النقل ${TRANSPORT_ROOM}.`,
          en: `Bring the original payment receipt to the Transportation office, ${TRANSPORT_ROOM}.`,
        },
    decisionNote:
      estimate === null
        ? null
        : {
            ar:
              `تمت الموافقة على استرداد ${formatMoney(estimate, "ar")}. الشيك هيبقى باسم ولي ` +
              `الأمر في خلال ${PAYOUT_DAYS} يوم، وهنبلغك أول ما يجهز. الاشتراك اتلغى.`,
            en:
              `A refund of ${formatMoney(estimate, "en")} is approved. The cheque will be in your ` +
              `guardian's name within ${PAYOUT_DAYS} days; we'll tell you when it's ready. The ` +
              `subscription is cancelled.`,
          },
    appliedAt: null,
    payload: {
      kind: RequestKind.Refund,
      subscriptionId: booking.subscriptionId,
      reason: body.reason,
      explanation: body.explanation,
      paidPiasters: paid,
      deductionPercent: deduction,
      estimatedRefundPiasters: estimate,
      guardianName: body.guardian_name,
      guardianPhone: body.guardian_phone,
      attachments: storeFiles(body.documents),
    },
  });
  return toStudentRequest(stored, language, now);
});

const COMPLAINT_REPLY: Record<ComplaintCategory, MockText> = {
  [ComplaintCategory.DriverBehaviour]: {
    ar: "اتكلمنا مع السواق وشركة أبو الهول، واتنبه عليه. لو اتكرر بلغنا فورًا.",
    en: "We spoke to the driver and Abu El Hol, and he has been warned. Tell us at once if it happens again.",
  },
  [ComplaintCategory.Delay]: {
    ar: "راجعنا مواعيد الخط مع الشركة وهنتابع الوصول الأيام الجاية.",
    en: "We reviewed the line's timings with the bus company and will watch arrivals over the next days.",
  },
  [ComplaintCategory.BusCondition]: {
    ar: "بلغنا الشركة والباص هيتراجع (تكييف ونضافة وكراسي) قبل الأسبوع الجاي.",
    en: "We told the bus company; the bus (air conditioning, cleaning, seats) will be checked before next week.",
  },
  [ComplaintCategory.Crowding]: {
    ar: "راجعنا عدد المشتركين على الخط، وكل طالب ليه كرسي. المشرف هيتأكد من الكروت عند الركوب.",
    en: "We checked the line's subscribers: every student has a seat. The supervisor will check cards when boarding.",
  },
  [ComplaintCategory.Safety]: {
    ar: "شكرًا إنك بلغت. اتعمل تحقيق مع الشركة، ولو في خطر دلوقتي استخدم زر الطوارئ.",
    en: "Thank you for reporting it. We opened an investigation with the bus company. If you are in danger now, use the emergency button.",
  },
  [ComplaintCategory.Payment]: {
    ar: "راجعنا الإيصال مع المالية. لو لسه في مشكلة، عدّي على مكتب الحسابات A045 ومعاك أصل الإيصال.",
    en: "We checked your receipt with Finance. If there is still a problem, visit the Accounting office, A045, with the original receipt.",
  },
  [ComplaintCategory.Other]: {
    ar: "شكرًا لملاحظتك، اتسجلت وبنتابعها.",
    en: "Thank you, your note is recorded and we are following it up.",
  },
};

registerMock(createComplaintEndpoint, ({ body }, { token, language }) => {
  const { user } = requireMockStudent(token);
  const now = Date.now();
  const booking = bookingOf(user.id, now);
  if (body.category === ComplaintCategory.Payment) {
    if (!booking) {
      throw new MockHttpError(
        HTTP.Conflict,
        RequestErrorCode.NoSubscription,
        "Book a seat before complaining about a payment.",
      );
    }
  } else {
    requireActiveBooking(user.id);
  }
  if (body.line_id !== null && !findMockLine(body.line_id)) {
    throw new MockHttpError(HTTP.NotFound, LineErrorCode.LineNotFound, "No such line.");
  }
  if (body.happened_on > todayInCairo(new Date(now)) || body.happened_on < MOCK_TERM.starts_on) {
    throw invalidDates("The date must be this term and not in the future.");
  }
  const stored = addRequest(user.id, {
    submittedAt: now,
    withdrawnAt: null,
    outcome: RequestStatus.Resolved,
    reviewNote: null,
    decisionNote: COMPLAINT_REPLY[body.category],
    appliedAt: null,
    payload: {
      kind: RequestKind.Complaint,
      category: body.category,
      lineId: body.line_id,
      happenedOn: body.happened_on,
      description: body.description,
      attachments: storeFiles(body.attachments),
    },
  });
  return toStudentRequest(stored, language, now);
});

registerMock(createModelPermitEndpoint, ({ body }, { token, language }) => {
  const { user } = requireMockStudent(token);
  const now = Date.now();
  const booking = requireActiveBooking(user.id);
  rejectIfOpen(user.id, RequestKind.ModelPermit, now);
  if (body.entry_date < todayInCairo(new Date(now))) {
    throw invalidDates("The model can't come in on a day that has passed.");
  }
  if (body.exit_date > MOCK_TERM.ends_on) {
    throw invalidDates("The dates are after the end of the term.");
  }
  const stored = addRequest(user.id, {
    submittedAt: now,
    withdrawnAt: null,
    outcome: RequestStatus.Approved,
    reviewNote: {
      ar:
        `استلمنا التصريح، وبعتناه لـ ${body.supervisor_name} يوقّع عليه، وبعدها لإدارة ` +
        `السلامة (Safety).`,
      en:
        `We got your permit and sent it to ${body.supervisor_name} to sign, then to the Safety ` +
        `department.`,
    },
    decisionNote: {
      ar:
        `إدارة السلامة وافقت. يوم ${body.entry_date} الساعة ${body.entry_time} ورّي التصريح ده ` +
        `للسواق والمشرف قبل ما تركب، وخلّي المجسم بعيد عن الممر.`,
      en:
        `The Safety department approved it. On ${body.entry_date} at ${body.entry_time}, show ` +
        `this permit to the driver and supervisor before you board, and keep the model out of ` +
        `the aisle.`,
    },
    appliedAt: null,
    payload: {
      kind: RequestKind.ModelPermit,
      student: {
        name: { ar: user.name_ar ?? user.name, en: user.name },
        universityId: user.identifier,
        faculty: user.faculty ? { ar: user.faculty_ar ?? user.faculty, en: user.faculty } : null,
        level: user.level ?? null,
      },
      lineId: booking.lineId,
      material: body.material,
      dimensions: body.dimensions,
      purpose: body.purpose,
      purposeOther: body.purpose_other,
      destination: body.destination,
      entryDate: body.entry_date,
      entryTime: body.entry_time,
      exitDate: body.exit_date,
      exitTime: body.exit_time,
      supervisorName: body.supervisor_name,
    },
  });
  return toStudentRequest(stored, language, now);
});

registerMock(withdrawRequestEndpoint, ({ params }, { token, language }) => {
  const { user } = requireMockStudent(token);
  const now = Date.now();
  const list = currentRequestsOf(user.id, now);
  const request = list.find((item) => item.requestId === params.request_id);
  if (!request)
    throw new MockHttpError(HTTP.NotFound, ServerErrorCode.NotFound, "No such request.");
  if (statusAt(request, now) !== RequestStatus.Submitted) {
    throw new MockHttpError(
      HTTP.Conflict,
      RequestErrorCode.NotWithdrawable,
      "The office has already started on this request.",
    );
  }
  const withdrawn = { ...request, withdrawnAt: now };
  saveRequests(
    user.id,
    list.map((item) => (item === request ? withdrawn : item)),
  );
  return toStudentRequest(withdrawn, language, now);
});

registerMock(getRefundPolicyEndpoint, (_input, { token, language }) => {
  const { user } = requireMockStudent(token);
  const booking = bookingOf(user.id);
  const isActive = booking?.status === SubscriptionStatus.Active;
  return {
    term_name: mockTerm(language).name,
    windows: [...MOCK_REFUND_WINDOWS],
    today_deduction_percent: deductionOn(MOCK_REFUND_WINDOWS, todayInCairo()),
    paid_piasters: isActive ? paidThisTerm(user.id, booking.subscriptionId) : null,
    subscription_id: isActive ? booking.subscriptionId : null,
    payout_days: PAYOUT_DAYS,
    processing_days: PROCESSING_DAYS,
  };
});
