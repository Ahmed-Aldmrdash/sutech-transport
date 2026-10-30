import { ErrorCode } from "@/lib/api/errors";
import { addDays, nowIso, today } from "../clock";
import { type SubscriptionRow, nextId } from "../db";
import { MockError, invalidState, notFound } from "../errors";
import {
  LIVE,
  audit,
  body,
  bookedSeats,
  currentSubscription,
  feed,
  findLine,
  lineCapacity,
  me,
  money,
  notify,
  notifyParents,
  requireActive,
} from "../helpers";
import { tx } from "../localized";
import { signCard } from "../qr";
import { lineView, mySubscriptionView, termView } from "../views";
import type { Handlers } from "./types";

function reservedSubscription(studentId: string, db: Parameters<typeof currentSubscription>[0]): SubscriptionRow {
  const row = currentSubscription(db, studentId);
  if (!row || row.status !== "reserved") throw new MockError(409, ErrorCode.ReservationExpired);
  return row;
}

export function activateSubscription(db: Parameters<typeof currentSubscription>[0], row: SubscriptionRow, method: SubscriptionRow["payment_method"]) {
  row.status = "active";
  row.paid_amount = row.price;
  row.payment_method = method;
  row.rejection_reason = null;
  notify(db, row.student_id, { ar: "اشتراكك اتفعّل. الكارنيه الرقمي جاهز.", en: "Your subscription is active. Your digital card is ready." }, "personal");
  notifyParents(db, row.student_id, { ar: "اشتراك النقل اتفعّل", en: "transport subscription is active" });
}

export const studentHandlers: Handlers = {
  "GET /lines": (ctx) => {
    const items = ctx.db.lines.map((line) => lineView(ctx.db, line, ctx));
    return { items, total: items.length };
  },
  "GET /lines/{line_id}": (ctx) => lineView(ctx.db, findLine(ctx.db, ctx.params.line_id!), ctx),
  "GET /term": (ctx) => termView(ctx.db, ctx),
  "GET /subscriptions/me": (ctx) => mySubscriptionView(ctx.db, me(ctx).id, ctx),

  "POST /subscriptions": (ctx) => {
    const user = me(ctx);
    const { line_id, stop_id } = body<{ line_id: string; stop_id: string }>(ctx);
    if (ctx.db.term.current.booking !== "open") throw new MockError(409, ErrorCode.BookingClosed);
    const existing = currentSubscription(ctx.db, user.id);
    if (existing && LIVE.includes(existing.status)) throw new MockError(409, ErrorCode.AlreadySubscribed);
    const line = findLine(ctx.db, line_id);
    const stop = line.stops.find((item) => item.id === stop_id);
    if (!stop || !stop.active || stop.is_destination) throw new MockError(400, ErrorCode.Validation, "stop");
    if (bookedSeats(ctx.db, line.id) >= lineCapacity(ctx.db, line)) throw new MockError(409, ErrorCode.SeatUnavailable);
    const row: SubscriptionRow = {
      id: nextId("SUB"),
      student_id: user.id,
      status: "reserved",
      line_id: line.id,
      stop_id: stop.id,
      price: line.price,
      reserved_at: nowIso(),
      paid_amount: null,
      payment_method: null,
      rejection_reason: null,
      assignment: null,
      fawry: null,
    };
    ctx.db.subscriptions.push(row);
    audit(ctx.db, user, { ar: `حجز مكان على ${ctx.t(line.name)}`, en: `Reserved a seat on ${ctx.t(line.name)}` });
    feed(ctx.db, { ar: `حجز جديد: ${user.name} – ${ctx.t(line.name)}`, en: `New booking: ${user.name} – ${ctx.t(line.name)}` });
    return mySubscriptionView(ctx.db, user.id, ctx);
  },

  "POST /subscriptions/me/cancel": (ctx) => {
    const user = me(ctx);
    const row = currentSubscription(ctx.db, user.id);
    if (!row || row.status !== "reserved") throw invalidState("only an unpaid reservation can be cancelled");
    row.status = "cancelled";
    audit(ctx.db, user, { ar: "إلغاء الحجز قبل الدفع", en: "Cancelled the reservation before paying" });
    return mySubscriptionView(ctx.db, user.id, ctx);
  },

  "POST /payments/fawry": (ctx) => {
    const user = me(ctx);
    const row = reservedSubscription(user.id, ctx.db);
    if (!row.fawry) {
      const digits = String(Math.floor(100_000_000 + Math.random() * 900_000_000));
      row.fawry = {
        code: digits.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3"),
        expires_at: new Date(new Date(row.reserved_at).getTime() + 24 * 3_600_000).toISOString(),
      };
      audit(ctx.db, user, { ar: `إنشاء كود فوري ${row.fawry.code}`, en: `Created Fawry reference ${row.fawry.code}` });
    }
    return { code: row.fawry.code, amount: row.price, expires_at: row.fawry.expires_at };
  },

  "POST /mock/fawry-paid": (ctx) => {
    const user = me(ctx);
    const row = reservedSubscription(user.id, ctx.db);
    if (!row.fawry) throw invalidState("no fawry code");
    ctx.db.payments.unshift({
      id: nextId("P"),
      student_id: user.id,
      subscription_id: row.id,
      amount: row.price,
      method: "fawry",
      reference: `FWR ${row.fawry.code}`,
      created_at: nowIso(),
      status: "approved",
      automatic: true,
      rejection_reason: null,
      receipt_image: null,
    });
    activateSubscription(ctx.db, row, "fawry");
    const amount = money(row.price);
    audit(ctx.db, "فوري (تلقائي)", {
      ar: `تأكيد دفع ${user.name} – ${tx(amount, "ar")}`,
      en: `Payment confirmed for ${user.name} – ${tx(amount, "en")}`,
    });
    feed(ctx.db, { ar: `فوري أكد دفع ${user.name}`, en: `Fawry confirmed ${user.name}'s payment` });
    return mySubscriptionView(ctx.db, user.id, ctx);
  },

  "POST /payments/receipt": (ctx) => {
    const user = me(ctx);
    const input = body<{ method: "instapay" | "bank_transfer"; reference: string; image: string }>(ctx);
    const row = reservedSubscription(user.id, ctx.db);
    const reference = input.reference.trim().toUpperCase();
    if (ctx.db.payments.some((payment) => payment.reference.toUpperCase() === reference)) {
      throw new MockError(409, ErrorCode.DuplicateReference);
    }
    ctx.db.payments.unshift({
      id: nextId("P"),
      student_id: user.id,
      subscription_id: row.id,
      amount: row.price,
      method: input.method,
      reference,
      created_at: nowIso(),
      status: "pending",
      automatic: false,
      rejection_reason: null,
      receipt_image: input.image,
    });
    row.status = "pending_payment";
    row.payment_method = input.method;
    row.rejection_reason = null;
    audit(ctx.db, user, { ar: `رفع إيصال ${reference}`, en: `Uploaded receipt ${reference}` });
    feed(ctx.db, { ar: `إيصال جديد مستني المراجعة: ${user.name}`, en: `New receipt to review: ${user.name}` });
    return mySubscriptionView(ctx.db, user.id, ctx);
  },

  "GET /card/me": (ctx) => {
    const user = me(ctx);
    const row = requireActive(ctx);
    const line = findLine(ctx.db, row.line_id);
    const stop = line.stops.find((item) => item.id === row.stop_id);
    if (!stop) throw notFound();
    const signed = signCard(user.id);
    return {
      student_id: user.id,
      name: user.name,
      faculty: user.faculty ? ctx.t(user.faculty) : "",
      level: user.level ? ctx.t(user.level) : "",
      line_name: ctx.t(line.name),
      stop_name: ctx.t(stop.name),
      term_name: ctx.t(ctx.db.term.current.name),
      valid_until: ctx.db.term.next?.starts_on ?? addDays(today(), 90),
      qr_token: signed.token,
      qr_expires_at: signed.expiresAt.toISOString(),
    };
  },
};
