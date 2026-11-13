import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAnnouncement, listAnnouncements } from "@/features/announcements/api";
import { resetOfficeAnnouncementsMock } from "@/features/announcements/mock";
import { login, requestOtp } from "@/features/auth/api";
import { resetAuthMock } from "@/features/auth/mock";
import { listNotifications } from "@/features/notifications/api";
import { NotificationKind } from "@/features/notifications/schema";
import { PaymentStatus } from "@/features/payments/schema";
import { getReport, listReports } from "@/features/reports/api";
import { ReportErrorCode } from "@/features/reports/schema";
import { resetStudentMock } from "@/features/subscriptions/mock-state";
import { SubscriptionStatus } from "@/features/subscriptions/schema";
import {
  actOnViolation,
  getDeskViolation,
  listDeskViolations,
} from "@/features/violation-desk/api";
import { ViolationDeskErrorCode } from "@/features/violation-desk/schema";
import { resetViolationsMock } from "@/features/violations/mock-state";
import { ViolationStatus } from "@/features/violations/schema";
import { ServerErrorCode, isApiError, type ApiError } from "@/lib/api/errors";
import { tokenStore } from "@/lib/api/token-store";
import {
  findAwaitingPayment,
  getOfficePayment,
  listOfficePayments,
  recordOfficePayment,
  reviewPayment,
} from "./api";
import { FinanceErrorCode } from "./schema";

const TERM_PRICE = 1_500_000;

async function errorOf(promise: Promise<unknown>): Promise<ApiError> {
  const caught: unknown = await promise.then(
    () => null,
    (error: unknown) => error,
  );
  if (!isApiError(caught)) throw new Error("expected an ApiError");
  return caught;
}

async function signIn(identifier: string) {
  const challenge = await requestOtp(identifier);
  await login(identifier, challenge.demo_code ?? "");
}

beforeEach(() => {
  resetAuthMock();
  resetStudentMock();
  resetViolationsMock();
  resetOfficeAnnouncementsMock();
});
afterEach(() => tokenStore.set(null));

describe("finance desk (mock server)", () => {
  it("lists the waiting receipts first and only to finance", async () => {
    await signIn("FIN-1001");
    const waiting = await listOfficePayments({ status: PaymentStatus.PendingReview });
    expect(waiting.items.map((item) => item.student.identifier)).toEqual([
      "240100151",
      "250100152",
      "260100153",
    ]);
    expect(waiting.counts.pending_review).toBe(3);
    const found = await listOfficePayments({ q: "NBE-6044190" });
    expect(found.items.length).toBeGreaterThan(0);

    await signIn("TRN-1001");
    expect((await errorOf(listOfficePayments())).code).toBe(ServerErrorCode.Forbidden);
  });

  it("approves a receipt (the seat becomes active) and refuses a second decision", async () => {
    await signIn("FIN-1001");
    const [first] = (await listOfficePayments({ status: PaymentStatus.PendingReview })).items;
    if (!first) throw new Error("no waiting receipt");
    const approved = await reviewPayment(first.payment_id, { decision: "approve", reason: null });
    expect(approved.status).toBe(PaymentStatus.Approved);
    expect(approved.subscription_status).toBe(SubscriptionStatus.Active);
    expect(approved.reviewed_by_name).toBeTruthy();
    const again = await errorOf(
      reviewPayment(first.payment_id, { decision: "reject", reason: "Wrong amount" }),
    );
    expect(again.code).toBe(FinanceErrorCode.AlreadyReviewed);
  });

  it("shows the student's earlier rejected receipt next to the new one", async () => {
    await signIn("FIN-1001");
    const [mostafa] = (await listOfficePayments({ q: "250100152", status: "pending_review" }))
      .items;
    if (!mostafa) throw new Error("no receipt");
    const detail = await getOfficePayment(mostafa.payment_id);
    expect(detail.other_payments.map((item) => item.status)).toEqual([PaymentStatus.Rejected]);
  });

  it("records a Visa payment at A045 for a held seat", async () => {
    await signIn("FIN-1001");
    expect((await errorOf(findAwaitingPayment("240100155"))).code).toBe(
      FinanceErrorCode.NotAwaitingPayment,
    );
    const booking = await findAwaitingPayment("260100154");
    expect(booking.price_piasters).toBe(TERM_PRICE);
    const short = await errorOf(
      recordOfficePayment({
        subscription_id: booking.subscription_id,
        reference_number: "POS-777001",
        amount_piasters: TERM_PRICE - 100,
        paid_on: "2026-11-12",
        payer_name: "Hany Rizk",
      }),
    );
    expect(short.code).toBe(FinanceErrorCode.AmountMismatch);
    const paid = await recordOfficePayment({
      subscription_id: booking.subscription_id,
      reference_number: "POS-777001",
      amount_piasters: TERM_PRICE,
      paid_on: "2026-11-12",
      payer_name: "Hany Rizk",
    });
    expect(paid.method).toBe("card_at_office");
    expect(paid.status).toBe(PaymentStatus.Approved);
    expect(paid.subscription_status).toBe(SubscriptionStatus.Active);
  });
});

describe("violation desk (mock server)", () => {
  it("lets Student Affairs open and close a report, and Transportation only read it", async () => {
    await signIn("TRN-1001");
    const list = await listDeskViolations({ status: ViolationStatus.Submitted });
    const [item] = list.items;
    if (!item) throw new Error("no new report");
    expect(item.allowed_actions).toEqual([]);
    expect(
      (
        await errorOf(
          actOnViolation(item.violation_id, { action: "open", outcome: null, note: null }),
        )
      ).code,
    ).toBe(ServerErrorCode.Forbidden);

    await signIn("STA-1001");
    const opened = await actOnViolation(item.violation_id, {
      action: "open",
      outcome: null,
      note: null,
    });
    expect(opened.status).toBe(ViolationStatus.UnderReview);
    expect(opened.opened_by_name).toBeTruthy();
    const closed = await actOnViolation(item.violation_id, {
      action: "close",
      outcome: "warning",
      note: "Talked to the student; first warning.",
    });
    expect(closed.status).toBe(ViolationStatus.Closed);
    expect(closed.decision?.outcome).toBe("warning");
    expect((await getDeskViolation(item.violation_id)).allowed_actions).toEqual([]);
    const late = await errorOf(
      actOnViolation(item.violation_id, { action: "open", outcome: null, note: null }),
    );
    expect(late.code).toBe(ViolationDeskErrorCode.ViolationClosed);
  });

  it("tells the student and their guardian about a warning, not about a dismissed report", async () => {
    await signIn("240100102");
    const student = await listNotifications({ page_size: 50 });
    const warning = student.items.find((item) => item.kind === NotificationKind.ViolationDecision);
    expect(warning?.title).toMatch(/إنذار/);
    expect(warning?.body).toMatch(/مزيكا أو أفلام بصوت عالي/);
    expect(warning?.link).toBeNull();

    await signIn("01000002001");
    const guardian = await listNotifications({ page_size: 50 });
    const childWarning = guardian.items.find(
      (item) => item.kind === NotificationKind.ViolationDecision,
    );
    expect(childWarning?.link).toEqual({ target: "child_day", id: "usr_student_2" });

    // The seeded smoking report on another student, dismissed: nobody is told.
    await signIn("STA-1001");
    const [open] = (await listDeskViolations({ status: ViolationStatus.Submitted })).items;
    if (!open) throw new Error("no new report");
    await actOnViolation(open.violation_id, {
      action: "close",
      outcome: "dismissed",
      note: "Could not confirm who it was.",
    });
    await signIn("240100102");
    const after = await listNotifications({ page_size: 50 });
    expect(
      after.items.filter((item) => item.kind === NotificationKind.ViolationDecision),
    ).toHaveLength(1);
  });
});

describe("office announcements (mock server)", () => {
  it("posts in both languages for one line, seen by that line's students only", async () => {
    await signIn("TRN-1001");
    await createAnnouncement({
      kind: "service_change",
      line_id: "ln_07",
      title_ar: "تغيير ميعاد محطة",
      title_en: "Stop time change",
      body_ar: "ميعاد المحطة الأولى بقى 6:40 من الأحد.",
      body_en: "The first stop is at 6:40 from Sunday.",
    });
    await signIn("240100102");
    const seif = await listAnnouncements();
    expect(seif.items.some((item) => item.title === "تغيير ميعاد محطة")).toBe(true);
    await signIn("240100101");
    const ziad = await listAnnouncements();
    expect(ziad.items.some((item) => item.title === "تغيير ميعاد محطة")).toBe(false);
  });

  it("refuses an announcement from finance", async () => {
    await signIn("FIN-1001");
    const refused = await errorOf(
      createAnnouncement({
        kind: "official",
        line_id: null,
        title_ar: "عنوان تجربة",
        title_en: "Test title",
        body_ar: "نص تجربة طويل كفاية.",
        body_en: "A long enough test text.",
      }),
    );
    expect(refused.code).toBe(ServerErrorCode.Forbidden);
  });
});

describe("reports (mock server)", () => {
  it("gives each office only its reports", async () => {
    await signIn("FIN-1001");
    expect((await listReports()).items.map((item) => item.type)).toEqual([
      "roster",
      "payments",
      "seat_occupancy",
    ]);
    expect((await errorOf(getReport("attendance", {}))).code).toBe(ServerErrorCode.Forbidden);
    await signIn("SGO-1001");
    expect((await listReports()).items).toHaveLength(4);
  });

  it("builds a full roster per line, paged", async () => {
    await signIn("TRN-1001");
    const roster = await getReport("roster", { line: "ln_07", page: 1, page_size: 10 });
    expect(roster.rows).toHaveLength(10);
    expect(roster.total).toBeGreaterThan(10);
    expect(roster.filters.line?.line_id).toBe("ln_07");
    expect(roster.columns.map((column) => column.key)).toContain("identifier");
  });

  it("limits attendance to a month and checks the period", async () => {
    await signIn("TRN-1001");
    const week = await getReport("attendance", { from: "2026-11-01", to: "2026-11-05" });
    expect(week.total).toBeGreaterThan(0);
    expect(week.rows.every((row) => typeof row.rate === "number")).toBe(true);
    expect(
      (await errorOf(getReport("attendance", { from: "2026-09-01", to: "2026-11-05" }))).code,
    ).toBe(ReportErrorCode.RangeTooLong);
    expect(
      (await errorOf(getReport("seat_occupancy", { from: "2026-11-05", to: "2026-11-01" }))).code,
    ).toBe(ReportErrorCode.InvalidRange);
  });

  it("totals the payments in the period", async () => {
    await signIn("FIN-1001");
    const report = await getReport("payments", { from: "2026-08-01", to: "2026-11-30" });
    expect(report.total).toBeGreaterThan(100);
    expect(report.summary).toHaveLength(3);
    expect(report.columns.find((column) => column.key === "amount")?.kind).toBe("money");
  });
});
