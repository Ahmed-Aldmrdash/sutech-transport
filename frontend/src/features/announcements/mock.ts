import { requireMockAccount } from "@/features/auth/mock-token";
import { findMockLine, localized, toLineSummary } from "@/features/lines/mock-builders";
import { bookingOf } from "@/features/subscriptions/mock-state";
import { SubscriptionStatus } from "@/features/subscriptions/schema";
import { registerMock } from "@/lib/api/mock/mock-server";
import { Role } from "@/lib/auth/roles";
import { listAnnouncementsEndpoint } from "./api";
import { AnnouncementKind, type Announcement } from "./schema";

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

/** Every announcement, newest first. Also read by the notifications mock. */
export function mockAnnouncements(language: string): Announcement[] {
  return MOCK_ANNOUNCEMENTS.map((item) => ({
    announcement_id: item.id,
    kind: item.kind,
    title: localized(language, item.titleAr, item.titleEn),
    body: localized(language, item.bodyAr, item.bodyEn),
    line: lineOf(item, language),
    published_at: item.publishedAt,
  }));
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
  if (user.role !== Role.Student) return all;
  const booking = bookingOf(user.id);
  const ownLine = booking && SEAT_STATUSES.includes(booking.status) ? booking.lineId : null;
  return all.filter((item) => item.line === null || item.line.line_id === ownLine);
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
