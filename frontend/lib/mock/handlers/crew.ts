import { Role } from "@/features/auth/roles";
import { ErrorCode } from "@/lib/api/errors";
import { formatTime } from "@/lib/time";
import { nowIso, today } from "../clock";
import { type Db, type SosRow, type TripRow, nextId } from "../db";
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
  notifyParents,
  publishAnnouncement,
  ridingLine,
  studentName,
} from "../helpers";
import { type Localized, both, tx } from "../localized";
import { emitMockLive } from "../live-bus";
import { verifyCard } from "../qr";
import { positionAt, tripFor } from "../route";
import { studentDayStatus } from "./day";
import type { Handlers } from "./types";

const CHECKOUT_REASON: Record<string, Localized> = {
  illness: both("تعبان", "feeling ill"),
  family_reason: both("ظرف عائلي", "family reason"),
  got_off_near_home: both("نزل قريب من البيت", "got off near home"),
  other: both("سبب تاني", "other reason"),
};

const DELAY_REASON: Record<string, Localized> = {
  traffic: both("زحمة", "Traffic"),
  breakdown: both("عطل في الباص", "Bus breakdown"),
  weather: both("الجو", "Weather"),
  checkpoint: both("كمين", "Checkpoint"),
  other: both("سبب تاني", "Other"),
};

const SOS_LABEL: Record<SosRow["kind"], Localized> = {
  medical: both("حالة طبية", "Medical"),
  bus_issue: both("مشكلة في الباص", "Bus problem"),
  accident: both("حادثة", "Accident"),
};

function crewTrip(ctx: Ctx, tripId?: string): TripRow {
  const user = me(ctx);
  if (!user.line_id) throw notFound();
  const trip = tripFor(ctx.db, user.line_id);
  if (tripId && trip.id !== tripId) throw forbidden();
  return trip;
}

function hhmm(iso: string): Localized {
  return { ar: formatTime(iso, "ar"), en: formatTime(iso, "en") };
}

function riderList(ctx: Ctx, trip: TripRow) {
  const line = findLine(ctx.db, trip.line_id);
  const date = today();
  return activeStudentsOn(ctx.db, trip.line_id).map((sub) => {
    const record = trip.riders[sub.student_id];
    const day = studentDayStatus(ctx.db, sub.student_id, date);
    const stop = line.stops.find((item) => item.id === sub.stop_id) ?? findLine(ctx.db, sub.line_id).stops.find((item) => item.id === sub.stop_id);
    const state = record?.state ?? (day.status === "skipped" ? "skipped" : day.status === "absent" ? "absent" : "waiting");
    return {
      student_id: sub.student_id,
      name: studentName(ctx.db, sub.student_id),
      stop_name: stop ? ctx.t(stop.name) : "",
      state,
      at: record?.at ?? (state === "skipped" ? day.at : null),
      detail: record?.detail ? ctx.t(record.detail) : null,
      priority_seat: ctx.db.permits.some(
        (permit) => permit.student_id === sub.student_id && permit.status === "active" && permit.kind === "priority_seat" && permit.to >= date,
      ),
    };
  });
}

export function tripView(ctx: Ctx, trip: TripRow) {
  const bus = ctx.db.buses.find((row) => row.id === trip.bus_id);
  const line = findLine(ctx.db, trip.line_id);
  return {
    trip_id: trip.id,
    line_id: trip.line_id,
    line_name: ctx.t(line.name),
    bus_plate: bus?.plate ?? "",
    driver_name: bus?.driver_name ?? "",
    direction: trip.direction,
    state: trip.state,
    started_at: trip.started_at,
    ended_at: trip.ended_at,
    delay_minutes: ctx.db.delays[trip.line_id]?.minutes ?? 0,
    riders: riderList(ctx, trip),
    open_sos_id: ctx.db.sos.find((row) => row.trip_id === trip.id && row.status !== "closed")?.id ?? null,
  };
}

export function sosView(ctx: Ctx, row: SosRow) {
  const line = findLine(ctx.db, row.line_id);
  const bus = ctx.db.buses.find((item) => item.id === row.bus_id);
  const replacement = row.replacement_bus_id ? ctx.db.buses.find((item) => item.id === row.replacement_bus_id) : null;
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    trip_id: row.trip_id,
    line_id: row.line_id,
    line_name: ctx.t(line.name),
    bus_plate: bus?.plate ?? "",
    driver_name: bus?.driver_name ?? "",
    note: row.note,
    position: row.position,
    created_at: row.created_at,
    ambulance_requested: row.ambulance_requested,
    replacement_bus_plate: replacement?.plate ?? null,
    log: row.log.map((entry) => ({ at: entry.at, text: ctx.t(entry.text), by: entry.by })),
  };
}

function findSos(ctx: Ctx): SosRow {
  const row = ctx.db.sos.find((item) => item.id === ctx.params.sos_id);
  if (!row) throw notFound();
  if (me(ctx).role === Role.Clinic && row.kind !== "medical") throw forbidden();
  return row;
}

function markArrivals(db: Db, trip: TripRow): void {
  const date = today();
  const at = nowIso();
  for (const [studentId, rider] of Object.entries(trip.riders)) {
    if (rider.state !== "boarded") continue;
    db.attendance.push({ student_id: studentId, date, type: trip.direction === "outbound" ? "arrived" : "return_arrived", at, detail: null, recorded_by: null });
    notifyParents(db, studentId, trip.direction === "outbound" ? both(`وصل الجامعة الساعة ${tx(hhmm(at), "ar")}`, `arrived at university at ${tx(hhmm(at), "en")}`) : both(`وصل محطته الساعة ${tx(hhmm(at), "ar")}`, `reached their stop at ${tx(hhmm(at), "en")}`));
  }
}

export const crewHandlers: Handlers = {
  "GET /driver/trip/today": (ctx) => tripView(ctx, crewTrip(ctx)),

  "POST /trips/{trip_id}/start": (ctx) => {
    const user = me(ctx);
    const trip = crewTrip(ctx, ctx.params.trip_id);
    if (trip.state === "in_progress") throw invalidState("already running");
    const { direction } = body<{ direction: TripRow["direction"] }>(ctx);
    trip.direction = direction;
    trip.state = "in_progress";
    trip.started_at = nowIso();
    trip.ended_at = null;
    trip.progress = 0;
    trip.riders = {};
    const line = findLine(ctx.db, trip.line_id);
    feed(ctx.db, both(`بدأت رحلة ${direction === "outbound" ? "الذهاب" : "العودة"} – ${tx(line.name, "ar")}`, `${direction === "outbound" ? "Outbound" : "Return"} trip started – ${tx(line.name, "en")}`));
    audit(ctx.db, user, both(`بداية رحلة ${direction === "outbound" ? "الذهاب" : "العودة"}`, `Started the ${direction} trip`));
    return tripView(ctx, trip);
  },

  "POST /trips/{trip_id}/end": (ctx) => {
    const user = me(ctx);
    const trip = crewTrip(ctx, ctx.params.trip_id);
    if (trip.state !== "in_progress") throw new MockError(409, ErrorCode.TripNotStarted);
    markArrivals(ctx.db, trip);
    let absent = 0;
    if (trip.direction === "outbound") {
      const date = today();
      for (const sub of activeStudentsOn(ctx.db, trip.line_id)) {
        if (trip.riders[sub.student_id]) continue;
        if (studentDayStatus(ctx.db, sub.student_id, date).status !== "waiting") continue;
        absent += 1;
        trip.riders[sub.student_id] = { state: "absent", at: nowIso(), detail: null };
        ctx.db.attendance.push({ student_id: sub.student_id, date, type: "absent", at: nowIso(), detail: null, recorded_by: null });
        notifyParents(ctx.db, sub.student_id, both("ما ركبش الباص النهارده واتسجل غياب", "did not board today and was marked absent"));
      }
    }
    trip.state = "ended";
    trip.ended_at = nowIso();
    trip.progress = 1;
    const line = findLine(ctx.db, trip.line_id);
    feed(ctx.db, both(`${tx(line.name, "ar")} وصلت${absent ? ` · ${absent} غياب` : ""}`, `${tx(line.name, "en")} arrived${absent ? ` · ${absent} absent` : ""}`));
    audit(ctx.db, user, both("نهاية الرحلة", "Ended the trip"));
    return tripView(ctx, trip);
  },

  "POST /trips/{trip_id}/scan": (ctx) => {
    const user = me(ctx);
    const trip = crewTrip(ctx, ctx.params.trip_id);
    if (trip.state !== "in_progress") throw new MockError(409, ErrorCode.TripNotStarted);
    const input = body<{ action: "board" | "checkout"; card: string; reason?: string; note?: string | null }>(ctx);
    const check = verifyCard(input.card);
    if (!check.ok) throw new MockError(400, check.reason === "expired" ? ErrorCode.CardExpired : ErrorCode.CardInvalid);
    const sub = currentSubscription(ctx.db, check.studentId);
    if (!sub || sub.status !== "active") throw new MockError(400, ErrorCode.CardInvalid);
    if (ridingLine(ctx.db, sub) !== trip.line_id) throw new MockError(400, ErrorCode.WrongLine);
    const date = today();
    const existing = trip.riders[check.studentId];
    const at = nowIso();
    if (input.action === "board") {
      if (existing?.state === "boarded") throw new MockError(409, ErrorCode.AlreadyScanned);
      if (existing?.state === "checked_out") throw invalidState("checked out");
      if (studentDayStatus(ctx.db, check.studentId, date).status === "skipped") {
        ctx.db.attendance.push({ student_id: check.studentId, date, type: "unskipped", at, detail: null, recorded_by: user.name });
      }
      const line = findLine(ctx.db, trip.line_id);
      const stop = line.stops.find((item) => item.id === sub.stop_id);
      trip.riders[check.studentId] = { state: "boarded", at, detail: stop?.name ?? null };
      ctx.db.attendance.push({
        student_id: check.studentId,
        date,
        type: trip.direction === "outbound" ? "boarded" : "return_boarded",
        at,
        detail: stop?.name ?? null,
        recorded_by: user.name,
      });
      notifyParents(ctx.db, check.studentId, both(`ركب الباص الساعة ${tx(hhmm(at), "ar")}`, `boarded the bus at ${tx(hhmm(at), "en")}`));
    } else {
      if (existing?.state !== "boarded") throw invalidState("not on the bus");
      const reason = CHECKOUT_REASON[input.reason ?? "other"]!;
      const detail: Localized = input.note ? both(`${tx(reason, "ar")} – ${input.note}`, `${tx(reason, "en")} – ${input.note}`) : reason;
      trip.riders[check.studentId] = { state: "checked_out", at, detail };
      ctx.db.attendance.push({ student_id: check.studentId, date, type: "checked_out", at, detail, recorded_by: user.name });
      notifyParents(ctx.db, check.studentId, both(`نزل من الباص في نص الرحلة الساعة ${tx(hhmm(at), "ar")} (${tx(detail, "ar")}). الجامعة مش مسؤولة عنه بعد النزول.`, `left the bus mid-trip at ${tx(hhmm(at), "en")} (${tx(detail, "en")}). The university is not responsible after this point.`));
      feed(ctx.db, both(`خروج في نص الرحلة: ${studentName(ctx.db, check.studentId)}`, `Mid-trip check-out: ${studentName(ctx.db, check.studentId)}`));
    }
    return { rider: riderList(ctx, trip).find((rider) => rider.student_id === check.studentId)! };
  },

  "POST /trips/{trip_id}/delay": (ctx) => {
    const user = me(ctx);
    const trip = crewTrip(ctx, ctx.params.trip_id);
    if (trip.state !== "in_progress") throw new MockError(409, ErrorCode.TripNotStarted);
    const input = body<{ minutes: number; reason: string }>(ctx);
    publishAnnouncement(ctx.db, {
      id: nextId("A"),
      kind: "delay",
      title: null,
      text: DELAY_REASON[input.reason] ?? DELAY_REASON.other!,
      target: trip.line_id,
      delay_minutes: input.minutes,
      pinned: false,
      to_parents: true,
      published_at: nowIso(),
      author: user.name,
      is_term_opening: false,
    });
    feed(ctx.db, both(`تأخير ${input.minutes} دقيقة – ${tx(findLine(ctx.db, trip.line_id).name, "ar")}`, `${input.minutes} min delay – ${tx(findLine(ctx.db, trip.line_id).name, "en")}`));
    return { ok: true };
  },

  "POST /sos": (ctx) => {
    const user = me(ctx);
    const input = body<{ trip_id: string; kind: SosRow["kind"]; note: string }>(ctx);
    const trip = crewTrip(ctx, input.trip_id);
    if (ctx.db.sos.some((row) => row.trip_id === trip.id && row.status !== "closed")) throw new MockError(409, ErrorCode.SosAlreadyOpen);
    const line = findLine(ctx.db, trip.line_id);
    const point = positionAt(line, trip.progress, trip.direction);
    const row: SosRow = {
      id: nextId("S"),
      kind: input.kind,
      status: "new",
      trip_id: trip.id,
      line_id: trip.line_id,
      bus_id: trip.bus_id,
      note: input.note,
      position: { lat: Number(point.lat.toFixed(5)), lng: Number(point.lng.toFixed(5)) },
      created_at: nowIso(),
      ambulance_requested: false,
      replacement_bus_id: null,
      log: [{ at: nowIso(), text: both(`بلاغ ${tx(SOS_LABEL[input.kind], "ar")} من الباص`, `${tx(SOS_LABEL[input.kind], "en")} SOS from the bus`), by: user.name }],
    };
    ctx.db.sos.unshift(row);
    if (input.kind !== "medical") {
      publishAnnouncement(ctx.db, {
        id: nextId("A"),
        kind: "delay",
        title: null,
        text: input.kind === "accident" ? both("حادثة على الطريق، والإدارة بتبعت باص بديل", "Accident on the road; a replacement bus is on its way") : both("مشكلة في الباص", "Problem with the bus"),
        target: trip.line_id,
        delay_minutes: input.kind === "accident" ? 30 : 10,
        pinned: false,
        to_parents: true,
        published_at: nowIso(),
        author: user.name,
        is_term_opening: false,
      });
    }
    feed(ctx.db, both(`SOS ${tx(SOS_LABEL[input.kind], "ar")} – ${tx(line.name, "ar")}`, `SOS ${tx(SOS_LABEL[input.kind], "en")} – ${tx(line.name, "en")}`));
    audit(ctx.db, user, both(`بلاغ SOS ${row.id}`, `SOS ${row.id} raised`));
    emitMockLive("sos.new", { id: row.id, kind: row.kind });
    return sosView(ctx, row);
  },

  "GET /sos/{sos_id}": (ctx) => {
    const row = findSos(ctx);
    const trip = crewTrip(ctx);
    if (row.trip_id !== trip.id) throw forbidden();
    return sosView(ctx, row);
  },

  "GET /admin/sos": (ctx) => {
    const user = me(ctx);
    return ctx.db.sos
      .filter((row) => user.role !== Role.Clinic || row.kind === "medical")
      .sort((a, b) => Number(a.status === "closed") - Number(b.status === "closed") || b.created_at.localeCompare(a.created_at))
      .map((row) => sosView(ctx, row));
  },

  "PATCH /admin/sos/{sos_id}": (ctx) => {
    const user = me(ctx);
    const row = findSos(ctx);
    const action = body<{ action: "acknowledge" | "request_ambulance" | "note" | "close"; note?: string }>(ctx);
    const office = user.role === Role.Clinic ? both("العيادة", "The clinic") : both("الإدارة", "The transport office");
    if (row.status === "closed") throw invalidState("closed");
    if (action.action === "acknowledge") {
      if (row.status !== "new") throw invalidState();
      row.status = "acknowledged";
      row.log.push({ at: nowIso(), text: both(`${tx(office, "ar")} استلمت البلاغ`, `${tx(office, "en")} acknowledged`), by: user.name });
      if (row.kind === "medical") {
        row.log.push({ at: nowIso(), text: both("دكتور العيادة بيكلم المشرف ويوجّهه", "The clinic doctor is guiding the supervisor"), by: user.name });
      }
    } else if (action.action === "request_ambulance") {
      if (row.status !== "acknowledged" || row.ambulance_requested) throw invalidState();
      row.ambulance_requested = true;
      row.log.push({ at: nowIso(), text: both("اتطلب إسعاف على موقع الباص", "Ambulance requested to the bus location"), by: user.name });
    } else if (action.action === "note") {
      row.log.push({ at: nowIso(), text: action.note!, by: user.name });
    } else {
      if (row.status !== "acknowledged") throw invalidState("acknowledge first");
      row.status = "closed";
      row.log.push({ at: nowIso(), text: both(`البلاغ اتقفل: ${action.note}`, `Closed: ${action.note}`), by: user.name });
      const delay = ctx.db.delays[row.line_id];
      if (row.kind !== "medical" && delay) {
        delete ctx.db.delays[row.line_id];
        publishAnnouncement(ctx.db, {
          id: nextId("A"),
          kind: "back_on_schedule",
          title: null,
          text: both("المشكلة اتحلت والباص كمّل", "Problem solved; the bus carried on"),
          target: row.line_id,
          delay_minutes: null,
          pinned: false,
          to_parents: true,
          published_at: nowIso(),
          author: user.name,
          is_term_opening: false,
        });
      }
    }
    audit(ctx.db, user, both(`SOS ${row.id}: ${action.action}`, `SOS ${row.id}: ${action.action}`));
    return sosView(ctx, row);
  },

  "POST /admin/trips/{trip_id}/replacement": (ctx) => {
    const user = me(ctx);
    const trip = ctx.db.trips.find((row) => row.id === ctx.params.trip_id);
    if (!trip) throw notFound();
    const input = body<{ bus_id: string; reason: string }>(ctx);
    const bus = ctx.db.buses.find((row) => row.id === input.bus_id);
    if (!bus || bus.status !== "ok" || !bus.driver_name) throw new MockError(400, ErrorCode.Validation, "bus");
    if (ctx.db.lines.some((line) => line.bus_id === bus.id)) throw invalidState("bus serves another line");
    const line = findLine(ctx.db, trip.line_id);
    const old = ctx.db.buses.find((row) => row.id === trip.bus_id);
    line.bus_id = bus.id;
    trip.bus_id = bus.id;
    publishAnnouncement(ctx.db, {
      id: nextId("A"),
      kind: "bus_change",
      title: null,
      text: both(`بسبب ${input.reason}، الباص بقى ${bus.plate} والسواق ${bus.driver_name}`, `Because of ${input.reason}, the bus is now ${bus.plate} with driver ${bus.driver_name}`),
      target: line.id,
      delay_minutes: null,
      pinned: false,
      to_parents: true,
      published_at: nowIso(),
      author: user.name,
      is_term_opening: false,
    });
    const sos = ctx.db.sos.find((row) => row.trip_id === trip.id && row.status !== "closed") ?? null;
    if (sos) {
      sos.replacement_bus_id = bus.id;
      sos.log.push({ at: nowIso(), text: both(`باص بديل ${bus.plate} في الطريق`, `Replacement bus ${bus.plate} on the way`), by: user.name });
    }
    audit(ctx.db, user, both(`تبديل باص ${tx(line.name, "ar")}: ${old?.plate ?? "-"} ← ${bus.plate} (${input.reason})`, `Swapped ${tx(line.name, "en")} bus: ${old?.plate ?? "-"} → ${bus.plate} (${input.reason})`));
    feed(ctx.db, both(`باص بديل لـ ${tx(line.name, "ar")}: ${bus.plate}`, `Replacement bus for ${tx(line.name, "en")}: ${bus.plate}`));
    return sos ? sosView(ctx, sos) : null;
  },

  "POST /violations": (ctx) => {
    const user = me(ctx);
    const input = body<{ student_id: string; type: Db["violations"][number]["type"]; description: string; photo: string | null }>(ctx);
    if (!ctx.db.users.some((row) => row.id === input.student_id && row.role === Role.Student)) throw new MockError(404, ErrorCode.NotFound, "student");
    const row = { id: nextId("V"), ...input, reported_by: user.name, created_at: nowIso(), status: "new" as const };
    ctx.db.violations.unshift(row);
    feed(ctx.db, both(`مخالفة جديدة من ${user.name}`, `New violation from ${user.name}`));
    return { ...row, student_name: studentName(ctx.db, row.student_id) };
  },

  "GET /admin/violations": (ctx) => ctx.db.violations.map((row) => ({ ...row, student_name: studentName(ctx.db, row.student_id) })),

  "PATCH /admin/violations/{violation_id}": (ctx) => {
    const user = me(ctx);
    const row = ctx.db.violations.find((item) => item.id === ctx.params.violation_id);
    if (!row) throw notFound();
    if (row.status !== "new") throw invalidState();
    row.status = body<{ status: "referred" | "dismissed" }>(ctx).status;
    audit(ctx.db, user, both(`${row.status === "referred" ? "إحالة" : "حفظ"} مخالفة ${row.id}`, `${row.status === "referred" ? "Referred" : "Filed"} violation ${row.id}`));
    return { ...row, student_name: studentName(ctx.db, row.student_id) };
  },
};
