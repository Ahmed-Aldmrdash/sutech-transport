import { beforeEach, describe, expect, it } from "vitest";
import { ErrorCode } from "@/lib/api/errors";
import { cairoDate } from "@/lib/time";
import { deleteAnnouncement, createAnnouncement, listAnnouncements, clearDelay } from "@/features/announcements/api";
import { getMe } from "@/features/auth/api";
import { getMyCard } from "@/features/card/api";
import { listLines } from "@/features/lines/api";
import { listNotifications } from "@/features/notifications/api";
import { listChildren } from "@/features/parent/api";
import { decidePayment, listPayments, uploadReceipt, createFawryCode, simulateFawryPaid } from "@/features/payments/api";
import { createRequest, parentDecide, adminDecide } from "@/features/requests/api";
import { getMySubscription, reserveSeat } from "@/features/subscriptions/api";
import { setBooking } from "@/features/term/api";
import { endTrip, getCrewTrip, scanCard, startTrip } from "@/features/trips/api";
import { getMyDay, skipToday } from "@/features/attendance/api";
import { listUsers, updateUser } from "@/features/overview/api";
import { freshServer, signInAs } from "./test-utils";

const AHMED = "240102791";
const OMAR = "240102684";
const RECEIPT = "data:image/png;base64,iVBORw0KGgo=";

async function expectError(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toMatchObject({ code });
}

async function subscribeAhmed() {
  await signInAs(AHMED);
  const lines = await listLines();
  const line = lines.items.find((item) => item.id === "L1")!;
  await reserveSeat(line.id, line.stops[1]!.id);
  await createFawryCode();
  return simulateFawryPaid();
}

describe("mock server", () => {
  beforeEach(() => freshServer());

  it("signs in with the OTP and rejects other roles' endpoints", async () => {
    const user = await signInAs(AHMED);
    expect(user.role).toBe("student");
    expect((await getMe()).name).toContain("الدمرداش");
    await expectError(listPayments(), ErrorCode.Forbidden);
  });

  it("locks the OTP after three wrong codes", async () => {
    const { requestOtp, login } = await import("@/features/auth/api");
    await requestOtp(AHMED);
    await expectError(login(AHMED, "0000"), ErrorCode.InvalidOtp);
    await expectError(login(AHMED, "0000"), ErrorCode.InvalidOtp);
    await expectError(login(AHMED, "0000"), ErrorCode.OtpLocked);
    await expectError(login(AHMED, "4821"), ErrorCode.OtpLocked);
  });

  it("books, pays with Fawry and issues a signed card", async () => {
    const sub = await subscribeAhmed();
    expect(sub.status).toBe("active");
    const card = await getMyCard();
    expect(card.qr_token.startsWith(`SUT1.${AHMED}.`)).toBe(true);
    await expectError(reserveSeat("L2", "L2-S1"), ErrorCode.AlreadySubscribed);
  });

  it("keeps the card closed to students who aren't active", async () => {
    await signInAs(AHMED);
    await expectError(getMyCard(), ErrorCode.SubscriptionRequired);
  });

  it("refuses booking while booking is closed", async () => {
    await signInAs("admin");
    await setBooking("closed");
    await signInAs(AHMED);
    await expectError(reserveSeat("L1", "L1-S1"), ErrorCode.BookingClosed);
  });

  it("sends a rejected receipt back to the student and accepts a new one", async () => {
    await signInAs(AHMED);
    await reserveSeat("L1", "L1-S1");
    await uploadReceipt({ method: "instapay", reference: "IPN123456", image: RECEIPT });
    await expectError(uploadReceipt({ method: "instapay", reference: "IPN123456", image: RECEIPT }), ErrorCode.ReservationExpired);
    await signInAs("finance");
    const pending = (await listPayments()).find((row) => row.reference === "IPN123456")!;
    await decidePayment(pending.id, false, "الصورة مش واضحة");
    await signInAs(AHMED);
    const sub = await getMySubscription();
    expect(sub.status).toBe("reserved");
    expect(sub.rejection_reason).toBe("الصورة مش واضحة");
    await expectError(uploadReceipt({ method: "instapay", reference: "IPN123456", image: RECEIPT }), ErrorCode.DuplicateReference);
  });

  it("scans boarding, then marks unscanned riders absent when the outbound trip ends", async () => {
    await subscribeAhmed();
    await signInAs("driver");
    let trip = await getCrewTrip();
    await expectError(scanCard(trip.trip_id, { action: "board", card: OMAR }), ErrorCode.TripNotStarted);
    trip = await startTrip(trip.trip_id, "outbound");
    await scanCard(trip.trip_id, { action: "board", card: OMAR });
    await expectError(scanCard(trip.trip_id, { action: "board", card: OMAR }), ErrorCode.AlreadyScanned);
    await expectError(scanCard(trip.trip_id, { action: "board", card: "250101850" }), ErrorCode.WrongLine);
    trip = await endTrip(trip.trip_id);
    const ahmed = trip.riders.find((rider) => rider.student_id === AHMED)!;
    const skipped = trip.riders.find((rider) => rider.student_id === "240102170")!;
    expect(ahmed.state).toBe("absent");
    expect(skipped.state).toBe("skipped");
    await signInAs("parent-240102791");
    const notes = await listNotifications();
    expect(notes.items.some((row) => row.text.includes("غياب"))).toBe(true);
    expect(notes.items.some((row) => row.text.includes("ركب الباص"))).toBe(true);
  });

  it("lets a student report not going today, and the day shows it", async () => {
    await subscribeAhmed();
    await skipToday(cairoDate());
    const day = await getMyDay();
    expect(day.skipped).toBe(true);
  });

  it("deletes an announcement for students and parents, with its notifications", async () => {
    await signInAs("transport");
    await createAnnouncement({
      kind: "official",
      title: "اختبار الحذف",
      text: "إعلان هيتمسح من عند الكل",
      target: "all",
      delay_minutes: null,
      pinned: true,
      to_parents: true,
      publish_at: null,
    });
    await signInAs(AHMED);
    const before = await listAnnouncements();
    const target = before.items.find((row) => row.title === "اختبار الحذف")!;
    expect((await listNotifications()).items.some((row) => row.announcement_id === target.id)).toBe(true);
    await signInAs("transport");
    await deleteAnnouncement(target.id);
    await signInAs(AHMED);
    expect((await listAnnouncements()).items.some((row) => row.id === target.id)).toBe(false);
    expect((await listNotifications()).items.some((row) => row.announcement_id === target.id)).toBe(false);
    await signInAs("parent-240102791");
    expect((await listNotifications()).items.some((row) => row.announcement_id === target.id)).toBe(false);
  });

  it("marks a delay as ended once the line is back on schedule", async () => {
    await subscribeAhmed();
    await signInAs("transport");
    await createAnnouncement({ kind: "delay", title: null, text: "زحمة على الطريق", target: "L1", delay_minutes: 15, pinned: false, to_parents: true, publish_at: null });
    await clearDelay("L1");
    await signInAs(AHMED);
    const delay = (await listAnnouncements()).items.find((row) => row.kind === "delay" && row.target === "L1")!;
    expect(delay.ended).toBe(true);
  });

  it("runs a refund through parent, transport and finance", async () => {
    await subscribeAhmed();
    const request = await createRequest({ type: "refund", reason: "سفر" });
    expect(request.steps.map((step) => step.actor)).toEqual(["parent", "transport", "finance"]);
    await expectError(createRequest({ type: "refund", reason: "تاني" }), ErrorCode.OpenRequestExists);
    await signInAs("finance");
    await expectError(adminDecide(request.id, true), ErrorCode.InvalidState);
    await signInAs("parent-240102791");
    await parentDecide(request.id, true);
    await signInAs("finance");
    await expectError(adminDecide(request.id, true), ErrorCode.Forbidden);
    await signInAs("transport");
    await adminDecide(request.id, true);
    await signInAs("finance");
    const done = await adminDecide(request.id, true);
    expect(done.status).toBe("approved");
    await signInAs(AHMED);
    expect((await getMySubscription()).status).toBe("refunded");
  });

  it("shows a parent only their own children", async () => {
    await signInAs("parent-240102791");
    const children = await listChildren();
    expect(children.map((child) => child.student_id).sort()).toEqual([OMAR, AHMED].sort());
  });

  it("never turns off the last super admin", async () => {
    await signInAs("admin");
    const users = await listUsers();
    const superAdmin = users.find((user) => user.role === "super_admin")!;
    await expectError(updateUser(superAdmin.id, { active: false }), ErrorCode.LastSuperAdmin);
  });
});
