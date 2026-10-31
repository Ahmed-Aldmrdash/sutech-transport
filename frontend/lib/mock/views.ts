import { Role } from "@/features/auth/roles";
import { today } from "./clock";
import type { AnnouncementRow, Db, LineRow, SubscriptionRow, TripRow, UserRow } from "./db";
import { type Ctx, bookedSeats, currentSubscription, lineCapacity, ridingLine, studentName, targetName } from "./helpers";
import { tx } from "./localized";
import { etaMinutes, positionAt, progressOfStop, tripFor } from "./route";

/* Rows → contract responses (snake_case, piasters, ISO UTC, text in the caller's language). */

export function userView(user: UserRow, ctx: Ctx) {
  return {
    id: user.id,
    role: user.role,
    name: user.name,
    identifier: user.identifier,
    faculty: user.faculty ? ctx.t(user.faculty) : null,
    level: user.level ? ctx.t(user.level) : null,
    guardian_name: user.guardian_name,
    masked_phone: user.masked_phone,
  };
}

export function lineView(db: Db, line: LineRow, ctx: Ctx) {
  const bus = db.buses.find((row) => row.id === line.bus_id) ?? null;
  const capacity = lineCapacity(db, line);
  const booked = bookedSeats(db, line.id);
  return {
    id: line.id,
    name: ctx.t(line.name),
    price: line.price,
    capacity,
    booked,
    seats_left: Math.max(0, capacity - booked),
    bus_id: bus?.id ?? null,
    bus_plate: bus?.plate ?? null,
    bus_type: bus ? ctx.t(bus.type) : null,
    driver_name: bus?.driver_name ?? null,
    operator: bus?.operator ?? "university",
    stops: line.stops.map((stop) => ({
      id: stop.id,
      name: ctx.t(stop.name),
      time: stop.time,
      active: stop.active,
      is_destination: stop.is_destination,
      lat: stop.lat,
      lng: stop.lng,
    })),
  };
}

export function subscriptionView(db: Db, row: SubscriptionRow | undefined, ctx: Ctx) {
  const termName = ctx.t(db.term.current.name);
  if (!row) {
    return {
      status: "none" as const,
      id: null,
      term_name: termName,
      line_id: null,
      line_name: null,
      stop_id: null,
      stop_name: null,
      price: null,
      reserved_until: null,
      paid_amount: null,
      payment_method: null,
      rejection_reason: null,
      assignment: null,
    };
  }
  const line = db.lines.find((item) => item.id === row.line_id);
  const stop = line?.stops.find((item) => item.id === row.stop_id);
  const assignmentLine = row.assignment ? db.lines.find((item) => item.id === row.assignment!.line_id) : undefined;
  const assignmentLive = row.assignment && ridingLine(db, row) === row.assignment.line_id;
  return {
    status: row.status,
    id: row.id,
    term_name: termName,
    line_id: row.line_id,
    line_name: line ? ctx.t(line.name) : null,
    stop_id: row.stop_id,
    stop_name: stop ? ctx.t(stop.name) : null,
    price: row.price,
    reserved_until: new Date(new Date(row.reserved_at).getTime() + 24 * 3_600_000).toISOString(),
    paid_amount: row.paid_amount,
    payment_method: row.payment_method,
    rejection_reason: row.rejection_reason,
    assignment:
      row.assignment && assignmentLive && assignmentLine
        ? {
            kind: row.assignment.kind,
            line_id: row.assignment.line_id,
            line_name: ctx.t(assignmentLine.name),
            until: row.assignment.until,
          }
        : null,
  };
}

export function mySubscriptionView(db: Db, studentId: string, ctx: Ctx) {
  return subscriptionView(db, currentSubscription(db, studentId), ctx);
}

export function termView(db: Db, ctx: Ctx) {
  const { current, next } = db.term;
  return {
    current: {
      name: ctx.t(current.name),
      booking: current.booking,
      booking_closes_on: current.booking_closes_on,
      week: current.week,
    },
    next: next
      ? {
          name: ctx.t(next.name),
          booking_opens_on: next.booking_opens_on,
          booking_closes_on: next.booking_closes_on,
          starts_on: next.starts_on,
        }
      : null,
    refund_policy: db.term.refund_policy,
  };
}

export function announcementView(db: Db, row: AnnouncementRow, ctx: Ctx) {
  const delayStillOn = Object.values(db.delays).some((delay) => delay.announcement_id === row.id);
  return {
    id: row.id,
    kind: row.kind,
    title: row.title ? ctx.t(row.title) : null,
    text: ctx.t(row.text),
    target: row.target,
    target_name: ctx.t(targetName(db, row.target)),
    delay_minutes: row.delay_minutes,
    pinned: row.pinned,
    to_parents: row.to_parents,
    published_at: row.published_at,
    author: ctx.t(row.author),
    ended: row.kind === "delay" && !delayStillOn,
  };
}

export function liveLineView(db: Db, lineId: string, ctx: Ctx, myStopId?: string) {
  const line = db.lines.find((row) => row.id === lineId)!;
  const trip: TripRow = tripFor(db, lineId);
  const bus = db.buses.find((row) => row.id === trip.bus_id);
  const delay = db.delays[lineId]?.minutes ?? 0;
  const running = trip.state === "in_progress";
  const point = positionAt(line, trip.progress, trip.direction);
  const ordered = trip.direction === "outbound" ? line.stops.filter((s) => s.active) : [...line.stops.filter((s) => s.active)].reverse();
  const riders = db.subscriptions.filter((row) => row.status === "active" && ridingLine(db, row) === lineId);
  // Simulated lines have no crew scanning cards, so riders count as boarded once the bus has passed their stop;
  // otherwise a moving bus would show "0 boarded".
  const boarded = trip.simulated
    ? riders.filter((row) => running && progressOfStop(line, row.stop_id, trip.direction) <= trip.progress).length
    : Object.values(trip.riders).filter((rider) => rider.state === "boarded").length;
  const base = {
    line_id: lineId,
    line_name: ctx.t(line.name),
    trip_id: trip.id,
    bus_plate: bus?.plate ?? null,
    driver_name: bus?.driver_name ?? null,
    direction: trip.direction,
    state: trip.state,
    position: running || trip.state === "ended" ? { lat: point.lat, lng: point.lng, at: new Date().toISOString() } : null,
    delay_minutes: delay,
    next_stop_name: running && ordered[point.nextIndex] ? ctx.t(ordered[point.nextIndex]!.name) : null,
    stops: ordered.map((stop, index) => ({
      id: stop.id,
      name: ctx.t(stop.name),
      time: stop.time,
      lat: stop.lat,
      lng: stop.lng,
      passed: running && index < point.nextIndex,
    })),
    riders_boarded: boarded,
    riders_total: riders.length,
  };
  if (!myStopId) return base;
  const target = trip.direction === "outbound" ? progressOfStop(line, myStopId, "outbound") : 1;
  return {
    ...base,
    my_stop_id: myStopId,
    eta_minutes: running ? etaMinutes(trip.progress, target, delay) : null,
  };
}

export function requestView(db: Db, row: Db["requests"][number], ctx: Ctx) {
  const details =
    row.details.type === "line_change"
      ? {
          ...row.details,
          to_line_name: ctx.t(db.lines.find((line) => line.id === (row.details as { to_line_id: string }).to_line_id)?.name ?? ""),
        }
      : row.details;
  return {
    id: row.id,
    student_id: row.student_id,
    student_name: studentName(db, row.student_id),
    created_at: row.created_at,
    status: row.status,
    reason: row.reason,
    details,
    steps: row.steps,
    rejection_reason: row.rejection_reason,
  };
}

export function isStaff(user: UserRow): boolean {
  return user.role !== Role.Student && user.role !== Role.Parent;
}

export function dayRecordView(db: Db, studentId: string, date: string, ctx: Ctx) {
  const events = db.attendance
    .filter((row) => row.student_id === studentId && row.date === date)
    .sort((a, b) => a.at.localeCompare(b.at));
  let skipped = false;
  for (const event of events) {
    if (event.type === "skipped") skipped = true;
    if (event.type === "unskipped") skipped = false;
  }
  return {
    student_id: studentId,
    student_name: studentName(db, studentId),
    date,
    skipped,
    events: events.map((event) => ({
      type: event.type,
      at: event.at,
      detail: event.detail ? ctx.t(event.detail) : null,
      recorded_by: event.recorded_by,
    })),
  };
}

export const isToday = (date: string) => date === today();
export { tx };
