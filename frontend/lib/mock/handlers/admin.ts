import { Role } from "@/features/auth/roles";
import { ErrorCode } from "@/lib/api/errors";
import { cairoDate } from "@/lib/time";
import { nowIso, today } from "../clock";
import { type BusRow, type Db, nextId } from "../db";
import { MockError, invalidState, notFound } from "../errors";
import {
  LIVE,
  type Ctx,
  activeStudentsOn,
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
  publishAnnouncement,
  ridingLine,
  studentName,
} from "../helpers";
import { both, tx } from "../localized";
import { lineView, subscriptionView } from "../views";
import { studentDayStatus } from "./day";
import { activateSubscription } from "./student";
import type { Handlers } from "./types";

function busView(ctx: Ctx, bus: BusRow) {
  const line = ctx.db.lines.find((row) => row.bus_id === bus.id) ?? null;
  return {
    id: bus.id,
    plate: bus.plate,
    type: ctx.t(bus.type),
    capacity: bus.capacity,
    operator: bus.operator,
    driver_name: bus.driver_name,
    line_id: line?.id ?? null,
    line_name: line ? ctx.t(line.name) : null,
    status: bus.status,
  };
}

function adminStudentView(ctx: Ctx, studentId: string) {
  const user = ctx.db.users.find((row) => row.id === studentId)!;
  const sub = subscriptionView(ctx.db, currentSubscription(ctx.db, studentId), ctx);
  return {
    id: user.id,
    name: user.name,
    faculty: user.faculty ? ctx.t(user.faculty) : "",
    level: user.level ? ctx.t(user.level) : "",
    status: sub.status,
    line_id: sub.line_id,
    line_name: sub.line_name,
    stop_name: sub.stop_name,
    assignment: sub.assignment,
  };
}

function paymentView(ctx: Ctx, row: Db["payments"][number]) {
  const sub = ctx.db.subscriptions.find((item) => item.id === row.subscription_id);
  const line = sub ? ctx.db.lines.find((item) => item.id === sub.line_id) : undefined;
  return {
    id: row.id,
    student_id: row.student_id,
    student_name: studentName(ctx.db, row.student_id),
    line_name: line ? ctx.t(line.name) : "",
    amount: row.amount,
    method: row.method,
    reference: row.reference,
    created_at: row.created_at,
    status: row.status,
    automatic: row.automatic,
    rejection_reason: row.rejection_reason,
    receipt_image: row.receipt_image,
  };
}

function eventView(row: Db["events"][number], ctx: Ctx) {
  return {
    ...row,
    university_buses: row.university_buses.map((id) => ctx.db.buses.find((bus) => bus.id === id)?.plate ?? id),
  };
}

function permitView(ctx: Ctx, row: Db["permits"][number]) {
  return {
    ...row,
    student_name: studentName(ctx.db, row.student_id),
    status: row.status === "active" && row.to < today() ? ("expired" as const) : row.status,
  };
}

const sparesFor = (db: Db) =>
  db.buses.filter((bus) => bus.status === "ok" && bus.driver_name && !db.lines.some((line) => line.bus_id === bus.id));

function csv(rows: (string | number)[][]): string {
  const escape = (value: string | number) => {
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  // Leading BOM so Excel opens Arabic correctly.
  return `﻿${rows.map((row) => row.map(escape).join(",")).join("\n")}`;
}

function toBase64(text: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(text)));
}

export const adminHandlers: Handlers = {
  "GET /admin/overview": (ctx) => {
    const db = ctx.db;
    const lines = db.lines.filter((line) => line.bus_id);
    return {
      active_subscribers: db.subscriptions.filter((row) => row.status === "active").length,
      seats_total: lines.reduce((sum, line) => sum + lineCapacity(db, line), 0),
      seats_booked: lines.reduce((sum, line) => sum + bookedSeats(db, line.id), 0),
      pending_payments: db.payments.filter((row) => row.status === "pending").length,
      open_requests: db.requests.filter((row) => row.status === "open").length,
      open_sos: db.sos.filter((row) => row.status !== "closed").length,
      trips_running: db.trips.filter((row) => row.date === today() && row.state === "in_progress").length,
      revenue_term: db.payments.filter((row) => row.status === "approved").reduce((sum, row) => sum + row.amount, 0),
      lines: lines.map((line) => ({
        line_id: line.id,
        line_name: ctx.t(line.name),
        capacity: lineCapacity(db, line),
        booked: bookedSeats(db, line.id),
        delay_minutes: db.delays[line.id]?.minutes ?? 0,
      })),
      feed: db.feed.slice(0, 12).map((item) => ({ at: item.at, text: ctx.t(item.text) })),
    };
  },

  "GET /admin/audit": (ctx) => {
    const page = Math.max(1, Number(ctx.query.page ?? 1));
    const size = Math.min(100, Math.max(1, Number(ctx.query.page_size ?? 50)));
    const items = ctx.db.audit.slice((page - 1) * size, page * size).map((row) => ({ at: row.at, actor: row.actor, action: ctx.t(row.action) }));
    return { items, total: ctx.db.audit.length };
  },

  "GET /admin/users": (ctx) =>
    ctx.db.users
      .filter((row) => row.role !== Role.Student && row.role !== Role.Parent)
      .map((row) => ({ id: row.id, name: row.name, role: row.role, active: row.active })),

  "POST /admin/users": (ctx) => {
    const user = me(ctx);
    const input = body<{ name: string; role: Role }>(ctx);
    if (input.role === Role.Student || input.role === Role.Parent) throw new MockError(400, ErrorCode.Validation, "role");
    const id = nextId("U");
    ctx.db.users.push({
      id,
      role: input.role,
      name: input.name,
      identifier: id.toLowerCase(),
      masked_phone: null,
      faculty: null,
      level: null,
      guardian_name: null,
      children: [],
      active: true,
      line_id: input.role === Role.Driver || input.role === Role.Supervisor ? "L1" : null,
    });
    audit(ctx.db, user, both(`إضافة حساب ${input.name} (${input.role})`, `Added account ${input.name} (${input.role})`));
    return { id, name: input.name, role: input.role, active: true };
  },

  "PATCH /admin/users/{user_id}": (ctx) => {
    const user = me(ctx);
    const row = ctx.db.users.find((item) => item.id === ctx.params.user_id);
    if (!row || row.role === Role.Student || row.role === Role.Parent) throw notFound();
    const update = body<{ active?: boolean; role?: Role }>(ctx);
    const activeSupers = ctx.db.users.filter((item) => item.role === Role.SuperAdmin && item.active);
    const losesSuper = row.role === Role.SuperAdmin && row.active && (update.active === false || (update.role && update.role !== Role.SuperAdmin));
    if (losesSuper && activeSupers.length < 2) throw new MockError(409, ErrorCode.LastSuperAdmin);
    if (update.active !== undefined) row.active = update.active;
    if (update.role) row.role = update.role;
    if (row.active === false) for (const [token, id] of Object.entries(ctx.db.sessions)) if (id === row.id) delete ctx.db.sessions[token];
    audit(ctx.db, user, both(`تعديل حساب ${row.name}`, `Updated account ${row.name}`));
    return { id: row.id, name: row.name, role: row.role, active: row.active };
  },

  "GET /admin/buses": (ctx) => ctx.db.buses.map((bus) => busView(ctx, bus)),

  "POST /admin/buses": (ctx) => {
    const user = me(ctx);
    const input = body<Omit<BusRow, "id" | "type"> & { type: string }>(ctx);
    if (ctx.db.buses.some((bus) => bus.plate === input.plate.trim())) throw new MockError(409, ErrorCode.Validation, "plate");
    const row: BusRow = { id: nextId("B"), ...input, plate: input.plate.trim() };
    ctx.db.buses.push(row);
    audit(ctx.db, user, both(`إضافة باص ${row.plate}`, `Added bus ${row.plate}`));
    return busView(ctx, row);
  },

  "PUT /admin/buses/{bus_id}": (ctx) => {
    const user = me(ctx);
    const row = ctx.db.buses.find((bus) => bus.id === ctx.params.bus_id);
    if (!row) throw notFound();
    const input = body<Omit<BusRow, "id" | "type"> & { type: string }>(ctx);
    const line = ctx.db.lines.find((item) => item.bus_id === row.id);
    if (line && input.status === "repair") throw invalidState("swap the bus off its line first");
    if (line && input.capacity < bookedSeats(ctx.db, line.id)) throw invalidState("capacity below booked seats");
    const changed = row.plate !== input.plate || row.driver_name !== input.driver_name;
    Object.assign(row, input);
    if (line && changed) {
      publishAnnouncement(ctx.db, {
        id: nextId("A"),
        kind: "bus_change",
        title: null,
        text: both(`الباص بقى ${row.plate}${row.driver_name ? ` والسواق ${row.driver_name}` : ""}`, `Your bus is now ${row.plate}${row.driver_name ? ` with driver ${row.driver_name}` : ""}`),
        target: line.id,
        delay_minutes: null,
        pinned: false,
        to_parents: false,
        published_at: nowIso(),
        author: user.name,
        is_term_opening: false,
      });
    }
    audit(ctx.db, user, both(`تعديل بيانات باص ${row.plate}`, `Edited bus ${row.plate}`));
    return busView(ctx, row);
  },

  "POST /admin/lines": (ctx) => {
    const user = me(ctx);
    const input = body<{ name: string; price: number; bus_id: string; stops: { name: string; time: string }[] }>(ctx);
    if (!sparesFor(ctx.db).some((bus) => bus.id === input.bus_id)) throw invalidState("bus not free");
    const id = nextId("L");
    const line = {
      id,
      name: input.name,
      price: input.price,
      bus_id: input.bus_id,
      stops: [
        ...input.stops.map((stop, index) => ({ id: `${id}-S${index + 1}`, name: stop.name, time: stop.time, active: true, is_destination: false, lat: 29.98 + index * 0.01, lng: 32.52 - index * 0.008 })),
        { id: `${id}-S${input.stops.length + 1}`, name: both("بوابة الجامعة", "University gate"), time: "07:40", active: true, is_destination: true, lat: 30.0405, lng: 32.493 },
      ],
    };
    ctx.db.lines.push(line);
    audit(ctx.db, user, both(`إنشاء ${input.name} بسعر ${tx(money(input.price), "ar")}`, `Created ${input.name} at ${tx(money(input.price), "en")}`));
    feed(ctx.db, both(`خط جديد: ${input.name}`, `New line: ${input.name}`));
    return lineView(ctx.db, line, ctx);
  },

  "PATCH /admin/lines/{line_id}": (ctx) => {
    const user = me(ctx);
    const line = findLine(ctx.db, ctx.params.line_id!);
    const { price } = body<{ price: number }>(ctx);
    const old = line.price;
    line.price = price;
    audit(ctx.db, user, both(`تغيير سعر ${tx(line.name, "ar")} من ${tx(money(old), "ar")} لـ ${tx(money(price), "ar")}`, `Changed ${tx(line.name, "en")} price from ${tx(money(old), "en")} to ${tx(money(price), "en")}`));
    return lineView(ctx.db, line, ctx);
  },

  "POST /admin/lines/{line_id}/stops": (ctx) => {
    const user = me(ctx);
    const line = findLine(ctx.db, ctx.params.line_id!);
    const input = body<{ name: string; time: string }>(ctx);
    if (line.stops.some((stop) => tx(stop.name, "ar") === input.name || tx(stop.name, "en") === input.name)) throw invalidState("duplicate stop");
    const last = line.stops.at(-1)!;
    line.stops.splice(line.stops.length - 1, 0, {
      id: `${line.id}-S${line.stops.length + 1}-${Date.now() % 1000}`,
      name: input.name,
      time: input.time,
      active: true,
      is_destination: false,
      lat: (last.lat + line.stops[0]!.lat) / 2,
      lng: (last.lng + line.stops[0]!.lng) / 2,
    });
    audit(ctx.db, user, both(`إضافة نقطة ${input.name} – ${tx(line.name, "ar")}`, `Added stop ${input.name} – ${tx(line.name, "en")}`));
    return lineView(ctx.db, line, ctx);
  },

  "PATCH /admin/lines/{line_id}/stops/{stop_id}": (ctx) => {
    const user = me(ctx);
    const line = findLine(ctx.db, ctx.params.line_id!);
    const stop = line.stops.find((item) => item.id === ctx.params.stop_id);
    if (!stop || stop.is_destination) throw notFound();
    const { active } = body<{ active: boolean }>(ctx);
    if (!active && ctx.db.subscriptions.some((row) => LIVE.includes(row.status) && row.stop_id === stop.id)) {
      throw invalidState("students are booked at this stop");
    }
    stop.active = active;
    audit(ctx.db, user, both(`${active ? "تفعيل" : "إلغاء"} نقطة ${tx(stop.name, "ar")}`, `${active ? "Enabled" : "Disabled"} stop ${tx(stop.name, "en")}`));
    return lineView(ctx.db, line, ctx);
  },

  "GET /admin/students": (ctx) => {
    const q = (ctx.query.q ?? "").trim();
    const lineId = ctx.query.line;
    const items = ctx.db.users
      .filter((row) => row.role === Role.Student)
      .filter((row) => !q || row.name.includes(q) || row.id.includes(q))
      .map((row) => adminStudentView(ctx, row.id))
      .filter((row) => !lineId || row.line_id === lineId || row.assignment?.line_id === lineId);
    return { items, total: items.length };
  },

  "POST /admin/students/{student_id}/transfer": (ctx) => {
    const user = me(ctx);
    const studentId = ctx.params.student_id!;
    const input = body<{ to_line_id: string; kind: "today" | "temporary" | "permanent"; until: string | null }>(ctx);
    const sub = currentSubscription(ctx.db, studentId);
    if (!sub || sub.status !== "active") throw new MockError(409, ErrorCode.SubscriptionRequired);
    const to = findLine(ctx.db, input.to_line_id);
    if (to.id === ridingLine(ctx.db, sub)) throw new MockError(400, ErrorCode.Validation, "same line");
    if (bookedSeats(ctx.db, to.id) >= lineCapacity(ctx.db, to)) throw new MockError(409, ErrorCode.SeatUnavailable);
    if (input.kind === "temporary" && (!input.until || input.until < today())) throw new MockError(400, ErrorCode.Validation, "until");
    if (input.kind === "permanent") {
      sub.line_id = to.id;
      sub.stop_id = to.stops.find((stop) => stop.active && !stop.is_destination)!.id;
      sub.assignment = null;
    } else {
      sub.assignment = { kind: input.kind, line_id: to.id, until: input.kind === "today" ? today() : input.until };
    }
    const label = { today: both("النهارده", "for today"), temporary: both(`لحد ${input.until}`, `until ${input.until}`), permanent: both("بشكل دائم", "permanently") }[input.kind];
    notify(ctx.db, studentId, both(`إدارة النقل نقلتك ${tx(label, "ar")} إلى ${tx(to.name, "ar")}.`, `The transport office moved you ${tx(label, "en")} to ${tx(to.name, "en")}.`), "personal");
    notifyParents(ctx.db, studentId, both(`اتنقل ${tx(label, "ar")} إلى ${tx(to.name, "ar")}`, `was moved ${tx(label, "en")} to ${tx(to.name, "en")}`));
    audit(ctx.db, user, both(`نقل ${studentName(ctx.db, studentId)} إلى ${tx(to.name, "ar")}`, `Moved ${studentName(ctx.db, studentId)} to ${tx(to.name, "en")}`));
    return adminStudentView(ctx, studentId);
  },

  "POST /admin/students/{student_id}/cancel": (ctx) => {
    const user = me(ctx);
    const studentId = ctx.params.student_id!;
    const { reason } = body<{ reason: string }>(ctx);
    const sub = currentSubscription(ctx.db, studentId);
    if (!sub || sub.status !== "active") throw invalidState("not active");
    sub.status = "cancelled";
    sub.assignment = null;
    notify(ctx.db, studentId, both("إدارة النقل لغت اشتراكك. راجع المكتب للتفاصيل.", "The transport office cancelled your subscription. Visit the office for details."), "personal");
    notifyParents(ctx.db, studentId, both("إدارة النقل لغت الاشتراك", "the transport office cancelled the subscription"));
    audit(ctx.db, user, both(`إلغاء اشتراك ${studentName(ctx.db, studentId)}: ${reason}`, `Cancelled ${studentName(ctx.db, studentId)}'s subscription: ${reason}`));
    feed(ctx.db, both(`إلغاء اشتراك ${studentName(ctx.db, studentId)}`, `Subscription cancelled: ${studentName(ctx.db, studentId)}`));
    return adminStudentView(ctx, studentId);
  },

  "GET /admin/payments": (ctx) =>
    [...ctx.db.payments]
      .sort((a, b) => Number(b.status === "pending") - Number(a.status === "pending") || b.created_at.localeCompare(a.created_at))
      .map((row) => paymentView(ctx, row)),

  "PATCH /admin/payments/{payment_id}": (ctx) => {
    const user = me(ctx);
    const row = ctx.db.payments.find((item) => item.id === ctx.params.payment_id);
    if (!row) throw notFound();
    if (row.status !== "pending") throw invalidState("already decided");
    const { approve, reason } = body<{ approve: boolean; reason: string | null }>(ctx);
    const sub = ctx.db.subscriptions.find((item) => item.id === row.subscription_id);
    if (approve) {
      row.status = "approved";
      if (sub) activateSubscription(ctx.db, sub, row.method);
      feed(ctx.db, both(`المالية وافقت على إيصال ${studentName(ctx.db, row.student_id)}`, `Finance approved ${studentName(ctx.db, row.student_id)}'s receipt`));
    } else {
      if (!reason) throw new MockError(400, ErrorCode.Validation, "reason");
      row.status = "rejected";
      row.rejection_reason = reason;
      if (sub && sub.status === "pending_payment") {
        sub.status = "reserved";
        sub.rejection_reason = reason;
      }
      notify(ctx.db, row.student_id, both(`المالية رفضت الإيصال: ${reason}. ارفع إيصال صحيح قبل ما مهلة الحجز تخلص.`, `Finance rejected your receipt: ${reason}. Upload a valid one before your reservation runs out.`), "personal");
    }
    audit(ctx.db, user, both(`${approve ? "موافقة على" : "رفض"} إيصال ${studentName(ctx.db, row.student_id)} ${row.id}`, `${approve ? "Approved" : "Rejected"} receipt ${row.id} (${studentName(ctx.db, row.student_id)})`));
    return paymentView(ctx, row);
  },

  "GET /admin/reports/{report_type}": (ctx) => {
    const user = me(ctx);
    const type = ctx.params.report_type!;
    const lineId = ctx.query.line;
    const date = ctx.query.date ?? today();
    let rows: (string | number)[][];
    if (type === "roster") {
      const lines = ctx.db.lines.filter((line) => !lineId || line.id === lineId);
      rows = [["student_id", "name", "line", "stop"]];
      for (const line of lines) {
        for (const sub of activeStudentsOn(ctx.db, line.id)) {
          const stop = findLine(ctx.db, sub.line_id).stops.find((item) => item.id === sub.stop_id);
          rows.push([sub.student_id, studentName(ctx.db, sub.student_id), ctx.t(line.name), stop ? ctx.t(stop.name) : ""]);
        }
      }
    } else if (type === "payments") {
      rows = [["id", "student", "amount_egp", "method", "reference", "status", "date"]];
      for (const payment of ctx.db.payments) {
        rows.push([payment.id, studentName(ctx.db, payment.student_id), payment.amount / 100, payment.method, payment.reference, payment.status, cairoDate(payment.created_at)]);
      }
    } else if (type === "attendance") {
      rows = [["student_id", "name", "line", "status"]];
      for (const line of ctx.db.lines.filter((item) => !lineId || item.id === lineId)) {
        for (const sub of activeStudentsOn(ctx.db, line.id)) {
          rows.push([sub.student_id, studentName(ctx.db, sub.student_id), ctx.t(line.name), studentDayStatus(ctx.db, sub.student_id, date).status]);
        }
      }
    } else if (type === "occupancy") {
      rows = [["line", "capacity", "booked", "free"]];
      for (const line of ctx.db.lines) {
        const capacity = lineCapacity(ctx.db, line);
        const booked = bookedSeats(ctx.db, line.id);
        rows.push([ctx.t(line.name), capacity, booked, Math.max(0, capacity - booked)]);
      }
    } else {
      throw notFound();
    }
    audit(ctx.db, user, both(`تصدير تقرير ${type}`, `Exported the ${type} report`));
    return {
      file_name: `sutech-${type}-${date}.csv`,
      mime_type: "text/csv;charset=utf-8",
      content_base64: toBase64(csv(rows)),
      rows: rows.length - 1,
    };
  },

  "GET /admin/clinic/permits": (ctx) => ctx.db.permits.map((row) => permitView(ctx, row)),

  "POST /admin/clinic/permits": (ctx) => {
    const user = me(ctx);
    const input = body<{ student_id: string; kind: Db["permits"][number]["kind"]; from: string; to: string }>(ctx);
    if (!ctx.db.users.some((row) => row.id === input.student_id && row.role === Role.Student)) throw notFound();
    if (input.from < today() || input.to < input.from) throw new MockError(400, ErrorCode.Validation, "dates");
    if (ctx.db.permits.some((row) => row.student_id === input.student_id && row.status === "active" && row.to >= today())) {
      throw invalidState("active permit exists");
    }
    const row = { id: nextId("M"), ...input, issued_by: user.name, status: "active" as const };
    ctx.db.permits.unshift(row);
    notify(ctx.db, input.student_id, both(`العيادة أصدرتلك تصريح لحد ${input.to}.`, `The clinic issued you a permit until ${input.to}.`), "personal");
    audit(ctx.db, user, both(`تصريح ${input.kind} لـ ${studentName(ctx.db, input.student_id)}`, `${input.kind} permit for ${studentName(ctx.db, input.student_id)}`));
    return permitView(ctx, row);
  },

  "POST /admin/clinic/permits/{permit_id}/revoke": (ctx) => {
    const user = me(ctx);
    const row = ctx.db.permits.find((item) => item.id === ctx.params.permit_id);
    if (!row) throw notFound();
    if (row.status !== "active") throw invalidState();
    row.status = "revoked";
    notify(ctx.db, row.student_id, both("تصريح العيادة بتاعك اتلغى.", "Your clinic permit was revoked."), "personal");
    audit(ctx.db, user, both(`إلغاء تصريح ${studentName(ctx.db, row.student_id)}`, `Revoked ${studentName(ctx.db, row.student_id)}'s permit`));
    return permitView(ctx, row);
  },

  "GET /admin/events": (ctx) => ctx.db.events.map((row) => eventView(row, ctx)),

  "POST /admin/events": (ctx) => {
    const user = me(ctx);
    const input = body<{ name: string; date: string; students: number }>(ctx);
    if (input.date < today()) throw new MockError(400, ErrorCode.Validation, "date");
    const busy = new Set(ctx.db.events.filter((row) => row.date === input.date && row.status !== "cancelled").flatMap((row) => row.university_buses));
    const spares = sparesFor(ctx.db).filter((bus) => !busy.has(bus.id));
    let seats = 0;
    const picked: string[] = [];
    for (const bus of spares) {
      if (seats >= input.students) break;
      picked.push(bus.id);
      seats += bus.capacity;
    }
    const remaining = Math.max(0, input.students - seats);
    const company = Math.ceil(remaining / 50);
    const row = {
      id: nextId("E"),
      name: input.name,
      date: input.date,
      students: input.students,
      buses_needed: picked.length + company,
      university_buses: picked,
      company_buses: company,
      status: company ? ("awaiting_company" as const) : ("confirmed" as const),
    };
    ctx.db.events.unshift(row);
    audit(ctx.db, user, both(`حجز باصات ${input.name} ${input.date}`, `Booked buses for ${input.name} on ${input.date}`));
    return eventView(row, ctx);
  },

  "POST /admin/events/{event_id}/cancel": (ctx) => {
    const user = me(ctx);
    const row = ctx.db.events.find((item) => item.id === ctx.params.event_id);
    if (!row) throw notFound();
    if (row.status === "cancelled") throw invalidState();
    row.status = "cancelled";
    audit(ctx.db, user, both(`إلغاء حجز باصات ${row.name}`, `Cancelled the bus booking for ${row.name}`));
    return eventView(row, ctx);
  },

  "GET /bus-company/requests": (ctx) => ctx.db.events.filter((row) => row.company_buses > 0).map((row) => eventView(row, ctx)),

  "POST /bus-company/requests/{event_id}": (ctx) => {
    const user = me(ctx);
    const row = ctx.db.events.find((item) => item.id === ctx.params.event_id);
    if (!row || row.company_buses === 0) throw notFound();
    if (row.status !== "awaiting_company") throw invalidState();
    const { accept } = body<{ accept: boolean }>(ctx);
    row.status = accept ? "confirmed" : "company_declined";
    audit(ctx.db, user, both(`${accept ? "تأكيد" : "اعتذار عن"} ${row.company_buses} باص لـ ${row.name}`, `${accept ? "Confirmed" : "Declined"} ${row.company_buses} buses for ${row.name}`));
    feed(ctx.db, both(`أبو الهول ${accept ? "أكدت" : "اعتذرت عن"} باصات ${row.name}`, `The bus company ${accept ? "confirmed" : "declined"} buses for ${row.name}`));
    return eventView(row, ctx);
  },

  "GET /parent/children": (ctx) =>
    me(ctx).children.map((studentId) => {
      const user = ctx.db.users.find((row) => row.id === studentId)!;
      const sub = subscriptionView(ctx.db, currentSubscription(ctx.db, studentId), ctx);
      return {
        student_id: studentId,
        name: user.name,
        faculty: user.faculty ? ctx.t(user.faculty) : "",
        level: user.level ? ctx.t(user.level) : "",
        subscription: sub,
        line_id: sub.assignment?.line_id ?? sub.line_id,
      };
    }),
};
