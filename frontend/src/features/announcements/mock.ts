import { recordAudit } from "@/features/admin-system/mock-log";
import { AuditAction } from "@/features/admin-system/schema";
import { requireMockAccount } from "@/features/auth/mock-token";
import { mockChildrenOf } from "@/features/children/mock-links";
import { allCrewDelays, allReplacements } from "@/features/crew/mock-state";
import { DelayReason } from "@/features/crew/schema";
import { findMockLine, localized, toLineSummary } from "@/features/lines/mock-builders";
import { mockFleetBus, mockFleetDriver } from "@/features/lines/mock-fleet";
import { actionsOf, allSos } from "@/features/sos/mock-state";
import { SosAction } from "@/features/sos/schema";
import { bookingOnDate } from "@/features/requests/mock-riding-line";
import { SubscriptionStatus } from "@/features/subscriptions/schema";
import { registerMock } from "@/lib/api/mock/mock-server";
import { formatPhone, todayInCairo } from "@/lib/format";
import { Role } from "@/lib/auth/roles";
import { createAnnouncementEndpoint, listAnnouncementsEndpoint } from "./api";
import { AnnouncementKind, type Announcement } from "./schema";
import { requireMockOffice } from "@/features/auth/mock-token";
import { newMockId } from "@/features/subscriptions/mock-state";
import { MockStorage, StoredMap } from "@/lib/api/mock/stored-map";
import { LineErrorCode } from "@/features/lines/schema";
import { MockHttpError } from "@/lib/api/mock/mock-server";

const DEFAULT_PAGE_SIZE = 20;

/** Notices taken from the Fall 2026 registration letter and Ahmed's notes (2026-11-02). */
const MOCK_ANNOUNCEMENTS = [
  {
    id: "ann_delay_ln05",
    kind: AnnouncementKind.Delay,
    lineId: "ln_05",
    publishedAt: "2026-11-02T05:10:00Z",
    titleAr: "خط 5 متأخر حوالي 10 دقايق",
    titleEn: "Line 5 is running about 10 minutes late",
    bodyAr: "زحمة على الدائري. الباص هيعدي على المحطات متأخر حوالي 10 دقايق النهارده.",
    bodyEn:
      "Heavy traffic on the Ring Road. The bus will reach each stop about 10 minutes late today.",
  },
  {
    id: "ann_delay_ln07",
    kind: AnnouncementKind.Delay,
    lineId: "ln_07",
    publishedAt: "2026-11-02T05:20:00Z",
    titleAr: "خط 7 متأخر حوالي 15 دقيقة",
    titleEn: "Line 7 is running about 15 minutes late",
    bodyAr: "زحمة على طريق السويس. الباص هيعدي على المحطات متأخر حوالي ربع ساعة النهارده.",
    bodyEn:
      "Heavy traffic on the Suez road. The bus will reach each stop about a quarter of an hour " +
      "late today.",
  },
  {
    id: "ann_return_times",
    kind: AnnouncementKind.ServiceChange,
    publishedAt: "2026-11-02T08:00:00Z",
    titleAr: "مواعيد العودة هتتعلن قريب",
    titleEn: "Return times coming soon",
    bodyAr: "إدارة النقل بتجهز مواعيد خروج الباصات من الجامعة لكل خط، وهتظهر هنا أول ما تتعلن.",
    bodyEn:
      "The Transportation office is preparing each line's afternoon departure times. They will " +
      "appear here as soon as they are published.",
  },
  {
    id: "ann_arrival_window",
    kind: AnnouncementKind.Official,
    publishedAt: "2026-11-01T09:00:00Z",
    titleAr: "الوصول للجامعة من 8:45 لـ 9:00",
    titleEn: "Buses reach campus 8:45 to 9:00",
    bodyAr: "كل الخطوط بتوصل الجامعة الصبح ما بين 8:45 و9:00. الباص بيستنى في المحطة دقيقتين بس.",
    bodyEn:
      "Every line reaches campus between 8:45 and 9:00 in the morning. The bus waits at each stop " +
      "for two minutes only.",
  },
  {
    id: "ann_payment_methods",
    kind: AnnouncementKind.Official,
    publishedAt: "2026-09-01T09:00:00Z",
    titleAr: "طرق الدفع المعتمدة",
    titleEn: "Accepted ways to pay",
    bodyAr:
      "الدفع بإيداع أو تحويل على حساب الجامعة في البنك الأهلي وترفع الإيصال هنا، أو بالفيزا في " +
      "مكتب الحسابات A045. مفيش أي طريقة دفع تانية معتمدة.",
    bodyEn:
      "Pay by deposit or transfer to the university's National Bank of Egypt account and upload " +
      "the receipt here, or by Visa at the Accounting office, room A045. No other method is accepted.",
  },
  {
    id: "ann_external_companies",
    kind: AnnouncementKind.Official,
    publishedAt: "2026-08-25T09:00:00Z",
    titleAr: "تحذير من شركات النقل الخارجية",
    titleEn: "Warning about outside transport companies",
    bodyAr:
      "الجامعة مالهاش علاقة بأي شركة نقل بتقول إنها تبعها. اتعامل مع إدارة النقل بالجامعة بس.",
    bodyEn:
      "The university has no link to any transport company claiming to work on its behalf. " +
      "Deal only with the university's Transportation office.",
  },
] as const;

function lineOf(item: (typeof MOCK_ANNOUNCEMENTS)[number], language: string) {
  const source = "lineId" in item ? findMockLine(item.lineId) : undefined;
  return source ? toLineSummary(source, language) : null;
}

const DELAY_REASON_TEXT: Record<DelayReason, { ar: string; en: string }> = {
  [DelayReason.Traffic]: { ar: "زحمة على الطريق", en: "Heavy traffic on the road" },
  [DelayReason.Breakdown]: { ar: "عطل بسيط في الباص", en: "A minor problem with the bus" },
  [DelayReason.Weather]: { ar: "الجو", en: "The weather" },
  [DelayReason.RoadClosed]: { ar: "طريق مقفول", en: "A closed road" },
  [DelayReason.Other]: { ar: "ظرف على الطريق", en: "Something on the way" },
};

/** What the server posts when a driver reports a delay (POST /trips/{id}/delay). */
function crewDelayAnnouncements(language: string): Announcement[] {
  return allCrewDelays().flatMap(({ lineId, delay }) => {
    const line = findMockLine(lineId);
    if (!line) return [];
    const reason = DELAY_REASON_TEXT[delay.reason];
    const minutes = String(delay.minutes);
    return [
      {
        announcement_id: `ann_${delay.delayId}`,
        kind: AnnouncementKind.Delay,
        title: localized(
          language,
          `خط ${line.code} متأخر حوالي ${minutes} دقيقة`,
          `Line ${line.code} is running about ${minutes} minutes late`,
        ),
        body: localized(
          language,
          `${reason.ar}. الباص هيعدي على المحطات متأخر حوالي ${minutes} دقيقة.${delay.note ? ` ${delay.note}` : ""}`,
          `${reason.en}. The bus will reach each stop about ${minutes} minutes late.${delay.note ? ` ${delay.note}` : ""}`,
        ),
        line: toLineSummary(line, language),
        published_at: new Date(delay.reportedAt).toISOString(),
      },
    ];
  });
}

/**
 * What the server tells a line's students and guardians when the office handles an emergency:
 * calm words with no medical details (agreement, "Emergencies (SOS)").
 */
function emergencyAnnouncements(language: string): Announcement[] {
  const notices: Announcement[] = [];
  const notice = (id: string, lineId: string, at: number, title: string, body: string) => {
    const line = findMockLine(lineId);
    if (!line) return;
    notices.push({
      announcement_id: id,
      kind: AnnouncementKind.ServiceChange,
      title,
      body,
      line: toLineSummary(line, language),
      published_at: new Date(at).toISOString(),
    });
  };
  for (const sos of allSos()) {
    const code = findMockLine(sos.lineId)?.code ?? "";
    notice(
      `ann_${sos.id}`,
      sos.lineId,
      sos.createdAt,
      localized(language, `باص خط ${code} واقف على الطريق`, `Line ${code}'s bus has stopped`),
      localized(
        language,
        "إدارة النقل بتتابع مع الباص دلوقتي، وهنبلغكم بأي جديد.",
        "The Transportation office is following up with the bus now and will update you.",
      ),
    );
    const closed = actionsOf(sos).find((entry) => entry.action === SosAction.Close);
    if (closed) {
      notice(
        `ann_${sos.id}_closed`,
        sos.lineId,
        closed.at,
        localized(language, `باص خط ${code}: الموقف اتحل`, `Line ${code}'s bus: all sorted`),
        localized(
          language,
          "إدارة النقل حلّت الموقف. شكرًا على صبركم.",
          "The Transportation office has handled it. Thank you for your patience.",
        ),
      );
    }
  }
  for (const { lineId, replacement } of allReplacements()) {
    const code = findMockLine(lineId)?.code ?? "";
    const bus = mockFleetBus(replacement.busId);
    const driver = mockFleetDriver(replacement.driverId);
    if (!bus || !driver) continue;
    const name = localized(language, driver.nameAr, driver.nameEn);
    notice(
      `ann_${replacement.replacementId}`,
      lineId,
      replacement.at,
      localized(language, `تغيير في باص خط ${code} النهارده`, `Line ${code} has a change today`),
      localized(
        language,
        `الباص دلوقتي ${bus.plate} والسواق ${name} (${formatPhone(driver.phone)}).`,
        `The bus is now ${bus.plate} with driver ${name} (${formatPhone(driver.phone)}).`,
      ),
    );
  }
  return notices;
}

interface MockOfficeAnnouncement {
  id: string;
  kind: typeof AnnouncementKind.Official | typeof AnnouncementKind.ServiceChange;
  lineId: string | null;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  publishedAt: number;
}

/** What the Transportation office posted from its announcements page. */
const officeAnnouncements = new StoredMap<MockOfficeAnnouncement>(
  "sut.mock.announcements",
  MockStorage.Local,
);

function postedByOffice(language: string): Announcement[] {
  return [...officeAnnouncements.values()].map((item) => {
    const line = item.lineId ? findMockLine(item.lineId) : undefined;
    return {
      announcement_id: item.id,
      kind: item.kind,
      title: localized(language, item.titleAr, item.titleEn),
      body: localized(language, item.bodyAr, item.bodyEn),
      line: line ? toLineSummary(line, language) : null,
      published_at: new Date(item.publishedAt).toISOString(),
    };
  });
}

/** Test helper. */
export function resetOfficeAnnouncementsMock(): void {
  officeAnnouncements.clear();
}

/** Every announcement, newest first. Also read by the notifications mock. */
function mockAnnouncements(language: string): Announcement[] {
  const fixed = MOCK_ANNOUNCEMENTS.map((item) => ({
    announcement_id: item.id,
    kind: item.kind,
    title: localized(language, item.titleAr, item.titleEn),
    body: localized(language, item.bodyAr, item.bodyEn),
    line: lineOf(item, language),
    published_at: item.publishedAt,
  }));
  return [
    ...postedByOffice(language),
    ...crewDelayAnnouncements(language),
    ...emergencyAnnouncements(language),
    ...fixed,
  ].sort((a, b) => b.published_at.localeCompare(a.published_at));
}

/** Statuses where the student holds a seat on a line, so that line's news is theirs. */
const SEAT_STATUSES: readonly SubscriptionStatus[] = [
  SubscriptionStatus.Reserved,
  SubscriptionStatus.PaymentReview,
  SubscriptionStatus.Active,
];

/**
 * What one account may see: a student gets notices for everyone plus their own line's news,
 * never another line's. Office staff see every line.
 */
export function mockAnnouncementsFor(
  user: { id: string; role: Role },
  language: string,
): Announcement[] {
  const all = mockAnnouncements(language);
  const lineOf = (studentId: string) => {
    const booking = bookingOnDate(studentId, todayInCairo());
    return booking && SEAT_STATUSES.includes(booking.status) ? booking.lineId : null;
  };
  // Students see their own line's news; guardians their children's lines only.
  let ownLines: (string | null)[];
  if (user.role === Role.Student) ownLines = [lineOf(user.id)];
  else if (user.role === Role.Parent) {
    ownLines = mockChildrenOf(user.id).map((child) => lineOf(child.user.id));
  } else return all;
  return all.filter((item) => item.line === null || ownLines.includes(item.line.line_id));
}

registerMock(listAnnouncementsEndpoint, ({ query }, { token, language }) => {
  const { user } = requireMockAccount(token);
  const page = query.page ?? 1;
  const pageSize = query.page_size ?? DEFAULT_PAGE_SIZE;
  const items = mockAnnouncementsFor(user, language).filter(
    (item) => !query.kind || item.kind === query.kind,
  );
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length };
});

registerMock(createAnnouncementEndpoint, ({ body }, { token, language }) => {
  const officer = requireMockOffice(token, [Role.Transport]);
  if (body.line_id !== null && !findMockLine(body.line_id)) {
    throw new MockHttpError(404, LineErrorCode.LineNotFound, "No such line.");
  }
  const item: MockOfficeAnnouncement = {
    id: newMockId("ann"),
    kind: body.kind,
    lineId: body.line_id,
    titleAr: body.title_ar.trim(),
    titleEn: body.title_en.trim(),
    bodyAr: body.body_ar.trim(),
    bodyEn: body.body_en.trim(),
    publishedAt: Date.now(),
  };
  officeAnnouncements.set(item.id, item);
  recordAudit(officer, AuditAction.AnnouncementPosted, { ar: item.titleAr, en: item.titleEn });
  const created = postedByOffice(language).find((entry) => entry.announcement_id === item.id);
  if (!created) throw new Error("unreachable");
  return created;
});
