import { mockAnnouncementsFor } from "@/features/announcements/mock";
import { AnnouncementKind } from "@/features/announcements/schema";
import { historyOf } from "@/features/attendance/mock";
import { TripOutcome } from "@/features/attendance/schema";
import { requireMockAccount } from "@/features/auth/mock-token";
import { firstNameOf } from "@/features/auth/user-text";
import { mockChildDay } from "@/features/children/mock";
import { mockChildrenOf } from "@/features/children/mock-links";
import { DayEventKind } from "@/features/children/schema";
import { MOCK_CAMPUS_ARRIVAL, findMockLine, localized } from "@/features/lines/mock-builders";
import { absencesOf } from "@/features/absences/mock-state";
import { awaitingGuardianOf, currentRequestsOf, toStudentRequest } from "@/features/requests/mock";
import { RequestActor, RequestKind, RequestStatus } from "@/features/requests/schema";
import { bookingOnDate } from "@/features/requests/mock-riding-line";
import { MockPaymentStatus, bookingOf, paymentsOf } from "@/features/subscriptions/mock-state";
import { SubscriptionStatus } from "@/features/subscriptions/schema";
import { ServerErrorCode } from "@/lib/api/errors";
import {
  MS_PER_MINUTE,
  SERVICE_DAYS,
  addDays,
  cairoInstant,
  cairoOffsetOn,
  cairoNow,
} from "@/lib/api/mock/cairo-clock";
import { MockHttpError, registerMock } from "@/lib/api/mock/mock-server";
import { formatServiceDay } from "@/lib/format";
import { MockStorage, StoredMap } from "@/lib/api/mock/stored-map";
import { Role } from "@/lib/auth/roles";
import {
  listNotificationsEndpoint,
  markAllNotificationsReadEndpoint,
  markNotificationReadEndpoint,
} from "./api";
import { NotificationKind, NotificationTarget, type AppNotification } from "./schema";

const DEFAULT_PAGE_SIZE = 20;
const HTTP_NOT_FOUND = 404;
/** The bus "is near" this many minutes before the pickup time. */
const BUS_NEAR_MINUTES = 5;
const DAYS_BACK_FOR_BUS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

interface ReadState {
  ids: string[];
  /** Everything created at or before this moment counts as read ("Mark all as read"). */
  allBefore: number;
}

/** A fresh demo starts with everything before November already read. */
const DEMO_READ_BEFORE = Date.parse("2026-11-01T00:00:00Z");
const readStates = new StoredMap<ReadState>("sut.mock.notifications.read", MockStorage.Local);

function readStateOf(userId: string): ReadState {
  return readStates.get(userId) ?? { ids: [], allBefore: DEMO_READ_BEFORE };
}

type Draft = Omit<AppNotification, "read_at">;

function paymentNotifications(userId: string, language: string): Draft[] {
  bookingOf(userId); // applies any review that is due
  return paymentsOf(userId).flatMap((payment): Draft[] => {
    if (payment.reviewedAt === null || payment.status === MockPaymentStatus.PendingReview) {
      return [];
    }
    const approved = payment.status === MockPaymentStatus.Approved;
    return [
      {
        notification_id: `ntf_pay_${payment.paymentId}`,
        kind: approved ? NotificationKind.PaymentApproved : NotificationKind.PaymentRejected,
        title: approved
          ? localized(
              language,
              "تم قبول الدفع، اشتراكك اتفعل",
              "Payment approved: you're subscribed",
            )
          : localized(language, "الإيصال اترفض", "Your receipt was rejected"),
        body: approved
          ? localized(
              language,
              "الكارت الرقمي بتاعك جاهز. ورّيه للمشرف وانت راكب.",
              "Your digital card is ready. Show it to the supervisor when you board.",
            )
          : localized(
              language,
              payment.rejectionReason?.ar ?? "",
              payment.rejectionReason?.en ?? "",
            ),
        created_at: new Date(payment.reviewedAt).toISOString(),
        link: {
          target: approved ? NotificationTarget.Card : NotificationTarget.Payment,
          id: null,
        },
      },
    ];
  });
}

const REQUEST_NAME = {
  [RequestKind.LineChange]: { ar: "طلب تغيير الخط", en: "line change request" },
  [RequestKind.Refund]: { ar: "طلب الاسترداد", en: "refund request" },
  [RequestKind.Complaint]: { ar: "الشكوى", en: "complaint" },
  [RequestKind.ModelPermit]: { ar: "تصريح دخول المجسم", en: "model permit" },
} as const;

const STATUS_PHRASE: Partial<Record<RequestStatus, { ar: string; en: string }>> = {
  [RequestStatus.InReview]: { ar: "قيد المراجعة", en: "is being reviewed" },
  [RequestStatus.Approved]: { ar: "اتوافق عليه", en: "was approved" },
  [RequestStatus.Rejected]: { ar: "اترفض", en: "was not approved" },
  [RequestStatus.Resolved]: { ar: "اترد عليها", en: "was answered" },
};

function requestNotifications(userId: string, language: string): Draft[] {
  return currentRequestsOf(userId).flatMap((stored) => {
    const request = toStudentRequest(stored, language);
    const name = REQUEST_NAME[request.kind];
    return request.timeline
      .filter((event) => event.by !== RequestActor.Student)
      .map((event): Draft => {
        const phrase =
          event.by === RequestActor.Guardian
            ? event.status === RequestStatus.Rejected
              ? { ar: "ولي الأمر مش موافق عليه", en: "was not approved by your guardian" }
              : {
                  ar: "ولي الأمر وافق عليه وراح لمكتب النقل",
                  en: "was approved by your guardian and sent to the office",
                }
            : (STATUS_PHRASE[event.status] ?? { ar: "", en: "" });
        return {
          notification_id: `ntf_req_${request.request_id}_${event.by}_${event.status}`,
          kind: NotificationKind.RequestUpdate,
          title: localized(
            language,
            `${name.ar} ${request.reference} ${phrase.ar}`,
            `Your ${name.en} ${request.reference} ${phrase.en}`,
          ),
          body:
            event.note ??
            localized(
              language,
              "افتح الطلب عشان تشوف التفاصيل.",
              "Open the request to see the details.",
            ),
          created_at: event.at,
          link: {
            target:
              request.kind === RequestKind.Complaint
                ? NotificationTarget.Complaint
                : NotificationTarget.Request,
            id: request.request_id,
          },
        };
      });
  });
}

function announcementNotifications(userId: string, role: Role, language: string): Draft[] {
  return mockAnnouncementsFor({ id: userId, role }, language).map((item) => ({
    notification_id: `ntf_ann_${item.announcement_id}`,
    kind:
      item.kind === AnnouncementKind.Delay
        ? NotificationKind.BusDelayed
        : NotificationKind.Announcement,
    title: item.title,
    body: item.body,
    created_at: item.published_at,
    link: { target: NotificationTarget.Announcements, id: null },
  }));
}

/** "Your bus is 5 minutes away" on each recent service day, from the bus's GPS in real life. */
function busNearNotifications(userId: string, language: string, now: number): Draft[] {
  const cairo = cairoNow(new Date(now));
  const drafts: Draft[] = [];
  for (let back = 0; back < DAYS_BACK_FOR_BUS; back += 1) {
    const date = addDays(cairo.date, -back);
    const booking = bookingOnDate(userId, date, now);
    const line = booking && findMockLine(booking.lineId);
    if (!booking || !line || booking.status !== SubscriptionStatus.Active) continue;
    const [pickup = "07:00", stopAr = "", stopEn = ""] = line.stops[booking.stopOrder - 1] ?? [];
    const weekday = (cairo.weekday - back + DAYS_BACK_FOR_BUS) % DAYS_BACK_FOR_BUS;
    const at = cairoInstant(date, pickup, cairoOffsetOn(date)) - BUS_NEAR_MINUTES * MS_PER_MINUTE;
    if (!SERVICE_DAYS.has(weekday) || at > now || at < (booking.activatedAt ?? now)) continue;
    drafts.push({
      notification_id: `ntf_bus_${line.lineId}_${date}`,
      kind: NotificationKind.BusNear,
      title: localized(
        language,
        `باص خط ${line.code} على بعد ${BUS_NEAR_MINUTES} دقايق`,
        `Line ${line.code} bus is ${BUS_NEAR_MINUTES} minutes away`,
      ),
      body: localized(
        language,
        `خليك في محطة ${stopAr} دلوقتي. الباص بيستنى دقيقتين بس.`,
        `Be at ${stopEn} now. The bus waits for two minutes only.`,
      ),
      created_at: new Date(at).toISOString(),
      link: { target: NotificationTarget.Tracking, id: null },
    });
  }
  return drafts;
}

const CHILD_KIND: Record<DayEventKind, NotificationKind | null> = {
  [DayEventKind.BusLeft]: null,
  [DayEventKind.Boarded]: NotificationKind.ChildBoarded,
  [DayEventKind.Arrived]: NotificationKind.ChildArrived,
  [DayEventKind.Absent]: NotificationKind.ChildAbsent,
  [DayEventKind.NotGoing]: NotificationKind.ChildNotGoing,
  [DayEventKind.CheckedOut]: NotificationKind.ChildCheckedOut,
};

/** The guardian's text for one thing that happened to their child. */
function childText(
  kind: DayEventKind,
  name: { ar: string; en: string },
  detail: string | null,
  language: string,
): { title: string; body: string } {
  const extra = detail ?? "";
  switch (kind) {
    case DayEventKind.Boarded:
      return {
        title: localized(language, `تم ركوب ${name.ar} الباص`, `${name.en} got on the bus`),
        body: localized(language, `الكارنيه اتمسح في محطة ${extra}.`, `Card scanned at ${extra}.`),
      };
    case DayEventKind.Arrived:
      return {
        title: localized(language, `وصول ${name.ar} الجامعة`, `${name.en} reached campus`),
        body: localized(
          language,
          "الباص وصل الجامعة، والركوب متسجل من الصبح.",
          "The bus reached campus with them on board.",
        ),
      };
    case DayEventKind.Absent:
      return {
        title: localized(
          language,
          `مفيش ركوب لـ${name.ar} النهارده`,
          `${name.en} wasn't on the bus today`,
        ),
        body: localized(
          language,
          "الباص وصل الجامعة من غير ما الكارنيه يتمسح، ومكانش فيه بلاغ بعدم الركوب.",
          "The bus reached campus without their card being scanned, and they hadn't said they'd skip today.",
        ),
      };
    case DayEventKind.NotGoing:
      return {
        title: localized(
          language,
          `بلاغ بعدم ركوب ${name.ar} النهارده`,
          `${name.en} won't ride today`,
        ),
        body: localized(
          language,
          `البلاغ من التطبيق: ${extra}`,
          `They said so in the app: ${extra}`,
        ),
      };
    case DayEventKind.CheckedOut:
      return {
        title: localized(
          language,
          `نزول ${name.ar} من الباص في الطريق`,
          `${name.en} left the bus on the way`,
        ),
        body: localized(language, `السبب: ${extra}`, `Reason: ${extra}`),
      };
    default:
      return { title: "", body: "" };
  }
}

/** What reached the guardian about each child in the last week: from the scans on the bus. */
function childNotifications(guardianId: string, language: string, now: number): Draft[] {
  const today = cairoNow(new Date(now)).date;
  const weekAgo = addDays(today, -DAYS_BACK_FOR_BUS);
  return mockChildrenOf(guardianId).flatMap(({ user }) => {
    const name = { ar: firstNameOf(user.name_ar ?? user.name), en: firstNameOf(user.name) };
    const events: { date: string; kind: DayEventKind; at: string; detail: string | null }[] = [];
    for (const record of historyOf(user.id, language, now)) {
      if (record.service_date >= today || record.service_date < weekAgo) continue;
      const date = record.service_date;
      if (record.boarded_at) {
        events.push({
          date,
          kind: DayEventKind.Boarded,
          at: record.boarded_at,
          detail: record.stop_name,
        });
      }
      if (record.arrived_at) {
        events.push({ date, kind: DayEventKind.Arrived, at: record.arrived_at, detail: null });
      }
      if (record.checked_out_at) {
        events.push({
          date,
          kind: DayEventKind.CheckedOut,
          at: record.checked_out_at,
          detail: record.checkout_reason,
        });
      }
      if (record.outcome === TripOutcome.Absent) {
        const at = new Date(
          cairoInstant(date, MOCK_CAMPUS_ARRIVAL.from, cairoOffsetOn(date)),
        ).toISOString();
        events.push({ date, kind: DayEventKind.Absent, at, detail: null });
      }
    }
    // Today's "not going" comes from the reports below, with the coming days.
    for (const event of mockChildDay(user.id, language, now).events) {
      if (event.kind !== DayEventKind.NotGoing) events.push({ date: today, ...event });
    }
    return events.flatMap((event): Draft[] => {
      const kind = CHILD_KIND[event.kind];
      if (!kind) return [];
      return [
        {
          notification_id: `ntf_child_${user.id}_${event.date}_${event.kind}`,
          kind,
          ...childText(event.kind, name, event.detail, language),
          created_at: event.at,
          link: { target: NotificationTarget.ChildDay, id: user.id },
        },
      ];
    });
  });
}

/** The day a report is for, as the guardian reads it: "today" or the date. */
function dayPhrase(date: string, today: string, language: string): { ar: string; en: string } {
  if (date === today) return { ar: "النهارده", en: "today" };
  // Latin digits in Arabic too, like every other date and time in the app.
  const shown = formatServiceDay(date, language === "ar" ? "ar" : "en");
  return { ar: `يوم ${shown}`, en: `on ${shown}` };
}

const ABSENCE_REASON_TEXT: Record<string, { ar: string; en: string }> = {
  sick: { ar: "تعبان", en: "Not feeling well" },
  no_lectures: { ar: "مفيش محاضرات", en: "No lectures" },
  personal: { ar: "ظرف شخصي", en: "Personal reason" },
  other: { ar: "سبب تاني", en: "Other reason" },
};

/** To guardians: each "not going" report, when it was made, for today or a coming day. */
function daysOffNotifications(guardianId: string, language: string, now: number): Draft[] {
  const today = cairoNow(new Date(now)).date;
  const weekAgo = now - DAYS_BACK_FOR_BUS * MS_PER_DAY;
  return mockChildrenOf(guardianId).flatMap(({ user }) => {
    const name = { ar: firstNameOf(user.name_ar ?? user.name), en: firstNameOf(user.name) };
    return absencesOf(user.id)
      .filter((item) => item.createdAt >= weekAgo)
      .map((item): Draft => {
        const day = dayPhrase(item.serviceDate, today, language);
        const reason = ABSENCE_REASON_TEXT[item.reason] ?? { ar: "", en: "" };
        const detail = item.note ?? localized(language, reason.ar, reason.en);
        return {
          notification_id: `ntf_off_${item.absenceId}`,
          kind: NotificationKind.ChildNotGoing,
          title: localized(
            language,
            `بلاغ بعدم ركوب ${name.ar} ${day.ar}`,
            `${name.en} won't ride ${day.en}`,
          ),
          body: localized(
            language,
            `البلاغ من التطبيق: ${detail}`,
            `They said so in the app: ${detail}`,
          ),
          created_at: new Date(item.createdAt).toISOString(),
          link: { target: NotificationTarget.ChildDay, id: user.id },
        };
      });
  });
}

/** To guardians: a child's line change waiting for their answer. */
function approvalNotifications(guardianId: string, language: string, now: number): Draft[] {
  return awaitingGuardianOf(guardianId, now).map(({ child, request }): Draft => {
    const name = localized(
      language,
      firstNameOf(child.user.name_ar ?? child.user.name),
      firstNameOf(child.user.name),
    );
    return {
      notification_id: `ntf_approve_${request.requestId}`,
      kind: NotificationKind.ApprovalNeeded,
      title: localized(
        language,
        `${name} طالب تغيير خط ومستني موافقتك`,
        `${name} asked to change line and needs your approval`,
      ),
      body: localized(
        language,
        "الطلب مش هيروح لمكتب النقل غير لما توافق. افتحه عشان توافق أو ترفض.",
        "It won't reach the Transportation office until you approve. Open it to approve or refuse.",
      ),
      created_at: new Date(request.submittedAt).toISOString(),
      link: { target: NotificationTarget.Approvals, id: null },
    };
  });
}

function notificationsFor(userId: string, role: Role, language: string): AppNotification[] {
  const now = Date.now();
  const drafts = [
    ...announcementNotifications(userId, role, language),
    ...(role === Role.Student
      ? [
          ...paymentNotifications(userId, language),
          ...requestNotifications(userId, language),
          ...busNearNotifications(userId, language, now),
        ]
      : []),
    ...(role === Role.Parent
      ? [
          ...childNotifications(userId, language, now),
          ...daysOffNotifications(userId, language, now),
          ...approvalNotifications(userId, language, now),
        ]
      : []),
  ];
  const read = readStateOf(userId);
  return drafts
    .filter((draft) => Date.parse(draft.created_at) <= now)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((draft) => {
      const created = Date.parse(draft.created_at);
      const isRead = created <= read.allBefore || read.ids.includes(draft.notification_id);
      return { ...draft, read_at: isRead ? draft.created_at : null };
    });
}

const unreadCount = (list: readonly AppNotification[]) =>
  list.filter((item) => item.read_at === null).length;

registerMock(listNotificationsEndpoint, ({ query }, { token, language }) => {
  const { user } = requireMockAccount(token);
  const all = notificationsFor(user.id, user.role, language);
  const listed = query.unread_only ? all.filter((item) => item.read_at === null) : all;
  const page = query.page ?? 1;
  const pageSize = query.page_size ?? DEFAULT_PAGE_SIZE;
  return {
    items: listed.slice((page - 1) * pageSize, page * pageSize),
    total: listed.length,
    unread_count: unreadCount(all),
  };
});

registerMock(markNotificationReadEndpoint, ({ params }, { token, language }) => {
  const { user } = requireMockAccount(token);
  const all = notificationsFor(user.id, user.role, language);
  if (!all.some((item) => item.notification_id === params.notification_id)) {
    throw new MockHttpError(HTTP_NOT_FOUND, ServerErrorCode.NotFound, "No such notification.");
  }
  const read = readStateOf(user.id);
  if (!read.ids.includes(params.notification_id)) {
    readStates.set(user.id, { ...read, ids: [...read.ids, params.notification_id] });
  }
  return { unread_count: unreadCount(notificationsFor(user.id, user.role, language)) };
});

registerMock(markAllNotificationsReadEndpoint, (_input, { token }) => {
  const { user } = requireMockAccount(token);
  readStates.set(user.id, { ids: [], allBefore: Date.now() });
  return { unread_count: 0 };
});

/** Test helper: forget what was read. */
export function resetNotificationsMock(): void {
  readStates.clear();
}
