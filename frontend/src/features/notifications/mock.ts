import { mockAnnouncements } from "@/features/announcements/mock";
import { AnnouncementKind } from "@/features/announcements/schema";
import { requireMockAccount } from "@/features/auth/mock-token";
import { findMockLine, localized } from "@/features/lines/mock-builders";
import { currentRequestsOf, toStudentRequest } from "@/features/requests/mock";
import { RequestActor, RequestKind, RequestStatus } from "@/features/requests/schema";
import { MockPaymentStatus, bookingOf, paymentsOf } from "@/features/subscriptions/mock-state";
import { SubscriptionStatus } from "@/features/subscriptions/schema";
import { ServerErrorCode } from "@/lib/api/errors";
import {
  MS_PER_MINUTE,
  SERVICE_DAYS,
  addDays,
  cairoInstant,
  cairoNow,
} from "@/lib/api/mock/cairo-clock";
import { MockHttpError, registerMock } from "@/lib/api/mock/mock-server";
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
        const phrase = STATUS_PHRASE[event.status] ?? { ar: "", en: "" };
        return {
          notification_id: `ntf_req_${request.request_id}_${event.status}`,
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

function announcementNotifications(language: string): Draft[] {
  return mockAnnouncements(language).map((item) => ({
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
  const booking = bookingOf(userId, now);
  const line = booking && findMockLine(booking.lineId);
  if (!booking || !line || booking.status !== SubscriptionStatus.Active) return [];
  const [pickup = "07:00", stopAr = "", stopEn = ""] = line.stops[booking.stopOrder - 1] ?? [];
  const cairo = cairoNow(new Date(now));
  const drafts: Draft[] = [];
  for (let back = 0; back < DAYS_BACK_FOR_BUS; back += 1) {
    const date = addDays(cairo.date, -back);
    const weekday = (cairo.weekday - back + DAYS_BACK_FOR_BUS) % DAYS_BACK_FOR_BUS;
    const at = cairoInstant(date, pickup, cairo.offsetMinutes) - BUS_NEAR_MINUTES * MS_PER_MINUTE;
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

function notificationsFor(userId: string, role: Role, language: string): AppNotification[] {
  const now = Date.now();
  const drafts = [
    ...announcementNotifications(language),
    ...(role === Role.Student
      ? [
          ...paymentNotifications(userId, language),
          ...requestNotifications(userId, language),
          ...busNearNotifications(userId, language, now),
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
