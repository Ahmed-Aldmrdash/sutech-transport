import { Role } from "@/features/auth/roles";
import { ErrorCode } from "@/lib/api/errors";
import { nowIso, today } from "../clock";
import { type Db, nextId } from "../db";
import { MockError, forbidden, invalidState, notFound } from "../errors";
import {
  type Ctx,
  activeStudentsOn,
  audit,
  body,
  currentSubscription,
  feed,
  findLine,
  me,
  notify,
  notifyParents,
  publishAnnouncement,
  requireActive,
  ridingLine,
  studentName,
} from "../helpers";
import { both, tx } from "../localized";
import { dayRecordView, liveLineView } from "../views";
import type { Handlers } from "./types";

export function studentDayStatus(db: Db, studentId: string, date: string) {
  const events = db.attendance.filter((row) => row.student_id === studentId && row.date === date);
  const last = (type: string) => events.filter((row) => row.type === type).at(-1);
  const skipped = events.reduce((state, row) => (row.type === "skipped" ? true : row.type === "unskipped" ? false : state), false);
  const absent = last("absent");
  if (absent) return { status: "absent" as const, at: absent.at, detail: null };
  const out = last("checked_out");
  if (out) return { status: "checked_out" as const, at: out.at, detail: out.detail };
  const arrived = last("arrived");
  if (arrived) return { status: "arrived" as const, at: arrived.at, detail: null };
  const boarded = last("boarded");
  if (boarded) return { status: "on_bus" as const, at: boarded.at, detail: null };
  if (skipped) return { status: "skipped" as const, at: last("skipped")?.at ?? null, detail: null };
  return { status: "waiting" as const, at: null, detail: null };
}

function trackingFor(ctx: Ctx, studentId: string) {
  const row = currentSubscription(ctx.db, studentId);
  if (!row || row.status !== "active") throw new MockError(403, ErrorCode.SubscriptionRequired);
  const lineId = ridingLine(ctx.db, row);
  const line = findLine(ctx.db, lineId);
  const stopId = line.stops.some((stop) => stop.id === row.stop_id)
    ? row.stop_id
    : (line.stops.find((stop) => stop.active && !stop.is_destination)?.id ?? row.stop_id);
  return liveLineView(ctx.db, lineId, ctx, stopId);
}

export function requireChild(ctx: Ctx, studentId: string) {
  const user = me(ctx);
  if (!user.children.includes(studentId)) throw forbidden();
}

function departureView(ctx: Ctx, row: Db["departures"][number]) {
  const user = ctx.user;
  return {
    id: row.id,
    time: row.time,
    line_id: row.line_id,
    line_name: row.line_id ? ctx.t(findLine(ctx.db, row.line_id).name) : ctx.t(both("كل الخطوط", "All lines")),
    capacity: row.capacity,
    booked: row.riders.length,
    reason: ctx.t(row.reason),
    status: row.status,
    joined: !!user && row.riders.includes(user.id),
    lecture_id: row.lecture_id,
  };
}

export const dayHandlers: Handlers = {
  "GET /attendance/me": (ctx) => dayRecordView(ctx.db, me(ctx).id, today(), ctx),

  "POST /absences": (ctx) => {
    const user = me(ctx);
    const row = requireActive(ctx);
    const { date } = body<{ date: string }>(ctx);
    if (date !== today()) throw new MockError(400, ErrorCode.Validation, "only today");
    const state = studentDayStatus(ctx.db, user.id, date);
    if (state.status === "skipped") return { ok: true };
    if (state.status !== "waiting") throw invalidState("already on the bus");
    ctx.db.attendance.push({ student_id: user.id, date, type: "skipped", at: nowIso(), detail: null, recorded_by: null });
    const line = findLine(ctx.db, ridingLine(ctx.db, row));
    notifyParents(ctx.db, user.id, both("بلّغ إنه مش رايح الجامعة النهارده", "reported not going to university today"));
    feed(ctx.db, both(`${user.name} مش رايح النهارده (${tx(line.name, "ar")})`, `${user.name} is not going today (${tx(line.name, "en")})`));
    return { ok: true };
  },

  "DELETE /absences/{date}": (ctx) => {
    const user = me(ctx);
    requireActive(ctx);
    const date = ctx.params.date!;
    if (studentDayStatus(ctx.db, user.id, date).status !== "skipped") throw invalidState("nothing to take back");
    ctx.db.attendance.push({ student_id: user.id, date, type: "unskipped", at: nowIso(), detail: null, recorded_by: null });
    notifyParents(ctx.db, user.id, both("رجع في كلامه وهيروح النهارده", "changed their mind and is going today"));
    feed(ctx.db, both(`${user.name} هيروح النهارده عادي`, `${user.name} is going today after all`));
    return { ok: true };
  },

  "GET /tracking/me": (ctx) => trackingFor(ctx, me(ctx).id),

  "GET /parent/children/{student_id}/tracking": (ctx) => {
    requireChild(ctx, ctx.params.student_id!);
    return trackingFor(ctx, ctx.params.student_id!);
  },

  "GET /admin/live": (ctx) => ctx.db.lines.filter((line) => line.bus_id).map((line) => liveLineView(ctx.db, line.id, ctx)),

  "GET /departures": (ctx) => {
    const user = me(ctx);
    const rows = ctx.db.departures.filter((row) => row.date === today());
    if (user.role !== Role.Student) return rows.map((row) => departureView(ctx, row));
    const sub = currentSubscription(ctx.db, user.id);
    const lineId = sub && sub.status === "active" ? ridingLine(ctx.db, sub) : null;
    return rows
      .filter((row) => row.status === "open" && lineId && (row.line_id === null || row.line_id === lineId))
      .map((row) => departureView(ctx, row));
  },

  "POST /departures/{departure_id}/join": (ctx) => {
    const user = me(ctx);
    requireActive(ctx);
    const row = ctx.db.departures.find((item) => item.id === ctx.params.departure_id);
    if (!row || row.status !== "open") throw notFound();
    if (row.riders.includes(user.id)) return { ok: true };
    if (row.riders.length >= row.capacity) throw new MockError(409, ErrorCode.SeatUnavailable);
    row.riders.push(user.id);
    return { ok: true };
  },

  "POST /departures/{departure_id}/leave": (ctx) => {
    const user = me(ctx);
    const row = ctx.db.departures.find((item) => item.id === ctx.params.departure_id);
    if (!row) throw notFound();
    row.riders = row.riders.filter((id) => id !== user.id);
    return { ok: true };
  },

  "POST /admin/departures": (ctx) => {
    const user = me(ctx);
    const input = body<{ time: string; line_id: string | null; bus_id: string; reason: string; lecture_id: string | null }>(ctx);
    const bus = ctx.db.buses.find((item) => item.id === input.bus_id);
    if (!bus || bus.status !== "ok") throw new MockError(400, ErrorCode.Validation, "bus");
    if (ctx.db.departures.some((row) => row.date === today() && row.status === "open" && row.time === input.time && row.line_id === input.line_id)) {
      throw invalidState("duplicate departure");
    }
    if (input.lecture_id && ctx.db.departures.some((row) => row.date === today() && row.status === "open" && row.lecture_id === input.lecture_id)) {
      throw invalidState("already announced for this lecture");
    }
    const row = {
      id: nextId("D"),
      time: input.time,
      line_id: input.line_id,
      bus_id: bus.id,
      capacity: bus.capacity,
      riders: [],
      reason: input.reason,
      status: "open" as const,
      lecture_id: input.lecture_id,
      date: today(),
    };
    ctx.db.departures.push(row);
    publishAnnouncement(ctx.db, {
      id: nextId("A"),
      kind: "extra_departure",
      title: null,
      text: both(`رحلة رجوع إضافية الساعة ${input.time}: ${input.reason}`, `Extra return trip at ${input.time}: ${input.reason}`),
      target: input.line_id ?? "all",
      delay_minutes: null,
      pinned: false,
      to_parents: false,
      published_at: nowIso(),
      author: user.name,
      is_term_opening: false,
    });
    audit(ctx.db, user, both(`إضافة رحلة مغادرة ${input.time}`, `Added an extra trip at ${input.time}`));
    return departureView(ctx, row);
  },

  "POST /admin/departures/{departure_id}/cancel": (ctx) => {
    const user = me(ctx);
    const row = ctx.db.departures.find((item) => item.id === ctx.params.departure_id);
    if (!row) throw notFound();
    if (row.status !== "open") throw invalidState();
    row.status = "cancelled";
    for (const studentId of row.riders) {
      notify(ctx.db, studentId, both(`رحلة الساعة ${row.time} اتلغت`, `The ${row.time} trip was cancelled`), "personal");
    }
    publishAnnouncement(ctx.db, {
      id: nextId("A"),
      kind: "trip_cancelled",
      title: null,
      text: both(`رحلة المغادرة ${row.time} اتلغت`, `The ${row.time} departure is cancelled`),
      target: row.line_id ?? "all",
      delay_minutes: null,
      pinned: false,
      to_parents: false,
      published_at: nowIso(),
      author: user.name,
      is_term_opening: false,
    });
    audit(ctx.db, user, both(`إلغاء رحلة ${row.time}`, `Cancelled the ${row.time} trip`));
    return { ok: true };
  },

  "GET /admin/lectures/today": (ctx) =>
    ctx.db.lectures.map((row) => ({
      id: row.id,
      group: ctx.t(row.group),
      ends_at: row.ends_at,
      students: row.students,
      note: row.note ? ctx.t(row.note) : null,
    })),

  "GET /admin/attendance": (ctx) => {
    const date = ctx.query.date ?? today();
    const lineFilter = ctx.query.line;
    const lines = ctx.db.lines.filter((line) => !lineFilter || line.id === lineFilter);
    const rows = lines.flatMap((line) =>
      activeStudentsOn(ctx.db, line.id).map((sub) => {
        const state = studentDayStatus(ctx.db, sub.student_id, date);
        return {
          student_id: sub.student_id,
          student_name: studentName(ctx.db, sub.student_id),
          line_id: line.id,
          line_name: ctx.t(line.name),
          status: state.status,
          at: state.at,
          detail: state.detail ? ctx.t(state.detail) : null,
        };
      }),
    );
    const totals = { arrived: 0, on_bus: 0, checked_out: 0, absent: 0, skipped: 0, waiting: 0 };
    for (const row of rows) totals[row.status] += 1;
    return { date, line_id: lineFilter ?? null, rows, totals };
  },
};
