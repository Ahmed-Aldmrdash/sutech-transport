import { Role } from "@/features/auth/roles";
import { ErrorCode } from "@/lib/api/errors";
import { cairoIso, nowIso, today } from "../clock";
import { type AnnouncementRow, type Db, type RequestRow, nextId } from "../db";
import { MockError, forbidden, invalidState, notFound } from "../errors";
import {
  LIVE,
  type Ctx,
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
  parentsOf,
  preferencesOf,
  publishAnnouncement,
  removeAnnouncement,
  requireActive,
  ridingLine,
  studentName,
  targetName,
} from "../helpers";
import { type Localized, both, tx } from "../localized";
import { announcementView, requestView, termView } from "../views";
import type { Handlers } from "./types";

/** Scheduled announcements whose time came (the real server runs this as a job). */
export function publishDue(db: Db): void {
  const due = db.scheduled.filter((row) => row.publish_at <= nowIso());
  if (!due.length) return;
  db.scheduled = db.scheduled.filter((row) => row.publish_at > nowIso());
  for (const row of due) publishScheduledRow(db, row);
}

function publishScheduledRow(db: Db, row: Db["scheduled"][number]): void {
  publishAnnouncement(db, {
    id: nextId("A"),
    kind: "official",
    title: row.title,
    text: row.text,
    target: row.target,
    delay_minutes: null,
    pinned: row.pinned,
    to_parents: row.to_parents,
    published_at: nowIso(),
    author: row.author,
    is_term_opening: row.is_term_opening,
  });
}

function visibleTo(ctx: Ctx, row: AnnouncementRow): boolean {
  const user = me(ctx);
  if (user.role === Role.Student) {
    if (row.kind === "official" && row.target === "all") return true;
    const sub = currentSubscription(ctx.db, user.id);
    if (!sub || !LIVE.includes(sub.status)) return false;
    return row.target === "all" || row.target === sub.line_id || row.target === ridingLine(ctx.db, sub);
  }
  if (user.role === Role.Parent) {
    if (!row.to_parents) return false;
    if (row.target === "all") return true;
    return user.children.some((childId) => {
      const sub = currentSubscription(ctx.db, childId);
      return !!sub && LIVE.includes(sub.status) && (sub.line_id === row.target || ridingLine(ctx.db, sub) === row.target);
    });
  }
  return true;
}

function scheduledView(ctx: Ctx, row: Db["scheduled"][number]) {
  return {
    id: row.id,
    title: ctx.t(row.title),
    text: ctx.t(row.text),
    target: row.target,
    target_name: ctx.t(targetName(ctx.db, row.target)),
    publish_at: row.publish_at,
    pinned: row.pinned,
    to_parents: row.to_parents,
    author: ctx.t(row.author),
    is_term_opening: row.is_term_opening,
  };
}

const steps = (...actors: RequestRow["steps"][number]["actor"][]): RequestRow["steps"] =>
  actors.map((actor, index) => ({ actor, state: index === 0 ? "current" : "waiting", at: null }));

const REQUEST_LABEL: Record<RequestRow["details"]["type"], Localized> = {
  refund: both("استرداد", "refund"),
  line_change: both("تغيير خط", "line change"),
  project_model: both("دخول مجسم مشروع", "project model"),
  guardian_change: both("تعديل بيانات ولي الأمر", "guardian details change"),
};

function finalizeRequest(ctx: Ctx, row: RequestRow): void {
  const db = ctx.db;
  const sub = currentSubscription(db, row.student_id);
  const details = row.details;
  if (details.type === "refund") {
    if (sub && sub.status === "active") {
      sub.status = "refunded";
      sub.assignment = null;
    }
    const amount = money(details.refund_amount);
    notify(db, row.student_id, both(`طلب الاسترداد ${row.id} اتقبل نهائيًا. هيتحولك ${tx(amount, "ar")} والكارنيه اتقفل.`, `Refund ${row.id} approved. ${tx(amount, "en")} will be transferred to you and your card is closed.`), "personal");
    notifyParents(db, row.student_id, both(`الاسترداد اتقبل (${tx(amount, "ar")})`, `refund approved (${tx(amount, "en")})`));
  } else if (details.type === "line_change") {
    const to = findLine(db, details.to_line_id);
    if (sub && sub.status === "active") {
      if (details.kind === "permanent") {
        if (bookedSeats(db, to.id) >= lineCapacity(db, to)) throw new MockError(409, ErrorCode.SeatUnavailable);
        sub.line_id = to.id;
        sub.stop_id = to.stops.find((stop) => stop.active && !stop.is_destination)!.id;
        sub.assignment = null;
      } else {
        sub.assignment = { kind: "temporary", line_id: to.id, until: details.until };
      }
    }
    notify(db, row.student_id, both(`تغيير الخط ${row.id} اتنفذ: ${tx(to.name, "ar")}`, `Line change ${row.id} done: ${tx(to.name, "en")}`), "personal");
    notifyParents(db, row.student_id, both(`اتنقل إلى ${tx(to.name, "ar")}`, `moved to ${tx(to.name, "en")}`));
  } else if (details.type === "project_model") {
    notify(db, row.student_id, both(`طلب دخول المجسم ${row.id} اتقبل. اعرض الكارنيه للمشرف يوم ${details.date}.`, `Project model request ${row.id} approved. Show your card to the supervisor on ${details.date}.`), "personal");
  } else {
    notify(db, row.student_id, both(`طلب تعديل بيانات ولي الأمر ${row.id} اتقبل.`, `Guardian details request ${row.id} approved.`), "personal");
  }
}

function decide(ctx: Ctx, row: RequestRow, approve: boolean, reason: string | null) {
  const index = row.steps.findIndex((step) => step.state === "current");
  const step = row.steps[index];
  if (!step || row.status !== "open") throw invalidState();
  step.at = nowIso();
  if (!approve) {
    step.state = "rejected";
    row.status = "rejected";
    row.rejection_reason = reason;
    notify(ctx.db, row.student_id, both(`طلبك ${row.id} اترفض: ${reason ?? ""}`, `Your request ${row.id} was rejected: ${reason ?? ""}`), "personal");
    return;
  }
  step.state = "done";
  const next = row.steps[index + 1];
  if (next) {
    next.state = "current";
    notify(ctx.db, row.student_id, both(`طلبك ${row.id} عدّى خطوة، ومستني ${next.actor === "finance" ? "المالية" : "إدارة النقل"}`, `Your request ${row.id} moved on; now waiting for ${next.actor === "finance" ? "finance" : "the transport office"}`), "personal");
    return;
  }
  finalizeRequest(ctx, row);
  row.status = "approved";
}

const ROLE_STEP: Partial<Record<string, RequestRow["steps"][number]["actor"]>> = {
  [Role.TransportAdmin]: "transport",
  [Role.Finance]: "finance",
};

function chatReply(ctx: Ctx, message: string): string {
  const en = ctx.locale === "en";
  const text = message.toLowerCase();
  const user = me(ctx);
  const sub = currentSubscription(ctx.db, user.id);
  const has = (...words: string[]) => words.some((word) => text.includes(word));
  if (has("سعر", "بكام", "price", "cost", "how much")) {
    const list = ctx.db.lines.map((line) => `${ctx.t(line.name)}: ${tx(money(line.price), ctx.locale)}`).join(" · ");
    return en ? `Term prices: ${list}.` : `أسعار الترم: ${list}.`;
  }
  if (has("استرداد", "refund", "فلوس")) {
    const week = ctx.db.term.current.week;
    const tier = ctx.db.term.refund_policy.find((row) => week >= row.from_week && (row.to_week === null || week <= row.to_week));
    return en
      ? `We're in week ${week}, so a refund now deducts ${tier?.deduction_percent ?? 0}%. Your parent approves first, then the transport office and finance. Apply from Requests.`
      : `إحنا في الأسبوع ${week}، فالاسترداد دلوقتي بيتخصم منه ${tier?.deduction_percent ?? 0}%. ولي أمرك بيوافق الأول، وبعدين إدارة النقل والمالية. قدّم من صفحة الطلبات.`;
  }
  if (has("باص", "ميعاد", "امتى", "bus", "when", "eta")) {
    if (!sub || sub.status !== "active") {
      return en ? "Once your subscription is active you'll see your bus live on the Track page." : "أول ما اشتراكك يتفعّل هتشوف الباص لايف من صفحة التتبع.";
    }
    const line = findLine(ctx.db, ridingLine(ctx.db, sub));
    const stop = line.stops.find((item) => item.id === sub.stop_id);
    const delay = ctx.db.delays[line.id];
    return en
      ? `Your bus on ${ctx.t(line.name)} picks you up at ${stop?.time ?? "--"}${delay ? `, running ${delay.minutes} min late today` : ""}. Open Track for the live ETA.`
      : `باص ${ctx.t(line.name)} بيعدي عليك الساعة ${stop?.time ?? "--"}${delay ? `، ومتأخر النهارده ${delay.minutes} دقيقة` : ""}. افتح التتبع عشان الوقت بالظبط.`;
  }
  if (has("دفع", "فوري", "انستا", "pay", "fawry", "instapay")) {
    return en
      ? "After you book you have 24 hours to pay: a Fawry reference (confirmed automatically) or an InstaPay / bank transfer receipt that finance reviews."
      : "بعد الحجز معاك 24 ساعة تدفع: كود فوري (بيتأكد لوحده)، أو إيصال إنستاباي أو تحويل بنكي والمالية بتراجعه.";
  }
  if (has("خط", "تغيير", "line", "change")) {
    return en
      ? "You can request a temporary or permanent line change from Requests. Your parent approves first, then the transport office."
      : "تقدر تطلب تغيير خط مؤقت أو دائم من صفحة الطلبات. ولي أمرك بيوافق الأول وبعدين إدارة النقل.";
  }
  return en
    ? "I can help with bus times, prices, booking and payment, refunds and line changes. What do you need?"
    : "أقدر أساعدك في مواعيد الباص، والأسعار، والحجز والدفع، والاسترداد وتغيير الخط. محتاج إيه؟";
}

export const communicationHandlers: Handlers = {
  "GET /announcements": (ctx) => {
    publishDue(ctx.db);
    const items = ctx.db.announcements
      .filter((row) => visibleTo(ctx, row))
      .sort((a, b) => b.published_at.localeCompare(a.published_at))
      .map((row) => announcementView(ctx.db, row, ctx));
    return { items, total: items.length };
  },

  "GET /admin/announcements": (ctx) => {
    publishDue(ctx.db);
    return {
      published: ctx.db.announcements.map((row) => announcementView(ctx.db, row, ctx)),
      scheduled: [...ctx.db.scheduled].sort((a, b) => a.publish_at.localeCompare(b.publish_at)).map((row) => scheduledView(ctx, row)),
    };
  },

  "POST /admin/announcements": (ctx) => {
    const user = me(ctx);
    const input = body<{
      kind: AnnouncementRow["kind"];
      title: string | null;
      text: string;
      target: string;
      delay_minutes: number | null;
      pinned: boolean;
      to_parents: boolean;
      publish_at: string | null;
    }>(ctx);
    if (input.target !== "all") findLine(ctx.db, input.target);
    if (input.kind === "delay" && !input.delay_minutes) throw new MockError(400, ErrorCode.Validation, "delay_minutes");
    if (input.kind === "official" && !input.title) throw new MockError(400, ErrorCode.Validation, "title");
    const last = ctx.db.announcements[0];
    if (last && last.target === input.target && last.kind === input.kind && tx(last.text, ctx.locale) === input.text) {
      throw invalidState("duplicate");
    }
    if (input.publish_at && input.publish_at > nowIso()) {
      if (input.kind !== "official") throw new MockError(400, ErrorCode.Validation, "only official announcements can be scheduled");
      ctx.db.scheduled.push({
        id: nextId("AS"),
        title: input.title!,
        text: input.text,
        target: input.target,
        publish_at: input.publish_at,
        pinned: input.pinned,
        to_parents: input.to_parents,
        author: user.name,
        is_term_opening: false,
      });
      audit(ctx.db, user, both(`جدولة إعلان «${input.title}»`, `Scheduled announcement “${input.title}”`));
      return { ok: true };
    }
    publishAnnouncement(ctx.db, {
      id: nextId("A"),
      kind: input.kind,
      title: input.title,
      text: input.text,
      target: input.target,
      delay_minutes: input.kind === "delay" ? input.delay_minutes : null,
      pinned: input.kind === "official" && input.pinned,
      to_parents: input.to_parents,
      published_at: nowIso(),
      author: user.name,
      is_term_opening: false,
    });
    audit(ctx.db, user, both(`نشر ${input.kind === "official" ? "إعلان رسمي" : "تنبيه"} «${input.title ?? input.text}»`, `Published “${input.title ?? input.text}”`));
    feed(ctx.db, both(`إعلان جديد: ${input.title ?? input.text}`, `New announcement: ${input.title ?? input.text}`));
    return { ok: true };
  },

  "PATCH /admin/announcements/{announcement_id}": (ctx) => {
    const user = me(ctx);
    const row = ctx.db.announcements.find((item) => item.id === ctx.params.announcement_id);
    if (!row) throw notFound();
    if (row.kind !== "official") throw invalidState("only official announcements can be pinned");
    row.pinned = body<{ pinned: boolean }>(ctx).pinned;
    audit(ctx.db, user, both(`${row.pinned ? "تثبيت" : "إلغاء تثبيت"} إعلان «${tx(row.title ?? row.text, "ar")}»`, `${row.pinned ? "Pinned" : "Unpinned"} “${tx(row.title ?? row.text, "en")}”`));
    return announcementView(ctx.db, row, ctx);
  },

  "DELETE /admin/announcements/{announcement_id}": (ctx) => {
    const user = me(ctx);
    const row = ctx.db.announcements.find((item) => item.id === ctx.params.announcement_id);
    if (!row) throw notFound();
    removeAnnouncement(ctx.db, row.id);
    audit(ctx.db, user, both(`حذف إعلان «${tx(row.title ?? row.text, "ar")}»`, `Deleted “${tx(row.title ?? row.text, "en")}”`));
    return { ok: true };
  },

  "POST /admin/announcements/scheduled/{scheduled_id}/publish": (ctx) => {
    const user = me(ctx);
    const row = ctx.db.scheduled.find((item) => item.id === ctx.params.scheduled_id);
    if (!row) throw notFound();
    if (row.is_term_opening) throw invalidState("the booking-opened notice publishes itself on the opening day");
    ctx.db.scheduled = ctx.db.scheduled.filter((item) => item.id !== row.id);
    publishScheduledRow(ctx.db, row);
    audit(ctx.db, user, both(`نشر إعلان مجدول «${tx(row.title, "ar")}» دلوقتي`, `Published scheduled “${tx(row.title, "en")}” now`));
    return { ok: true };
  },

  "DELETE /admin/announcements/scheduled/{scheduled_id}": (ctx) => {
    const user = me(ctx);
    const row = ctx.db.scheduled.find((item) => item.id === ctx.params.scheduled_id);
    if (!row) throw notFound();
    ctx.db.scheduled = ctx.db.scheduled.filter((item) => item.id !== row.id);
    audit(ctx.db, user, both(`إلغاء إعلان مجدول «${tx(row.title, "ar")}»`, `Cancelled scheduled “${tx(row.title, "en")}”`));
    return { ok: true };
  },

  "GET /admin/delays": (ctx) =>
    Object.entries(ctx.db.delays).map(([lineId, delay]) => ({
      line_id: lineId,
      line_name: ctx.t(findLine(ctx.db, lineId).name),
      minutes: delay.minutes,
      reason: ctx.t(delay.reason),
      announcement_id: delay.announcement_id,
    })),

  "POST /admin/delays/{line_id}/clear": (ctx) => {
    const user = me(ctx);
    const lineId = ctx.params.line_id!;
    if (user.role === Role.Driver && user.line_id !== lineId) throw forbidden();
    if (!ctx.db.delays[lineId]) throw invalidState("no delay");
    delete ctx.db.delays[lineId];
    publishAnnouncement(ctx.db, {
      id: nextId("A"),
      kind: "back_on_schedule",
      title: null,
      text: both("الباص رجع على الجدول", "The bus is back on schedule"),
      target: lineId,
      delay_minutes: null,
      pinned: false,
      to_parents: false,
      published_at: nowIso(),
      author: user.name,
      is_term_opening: false,
    });
    audit(ctx.db, user, both(`رجوع ${tx(findLine(ctx.db, lineId).name, "ar")} للميعاد`, `${tx(findLine(ctx.db, lineId).name, "en")} back on schedule`));
    return { ok: true };
  },

  "GET /notifications": (ctx) => {
    publishDue(ctx.db);
    const user = me(ctx);
    const items = ctx.db.notifications
      .filter((row) => row.user_id === user.id)
      .map((row) => ({ id: row.id, text: ctx.t(row.text), created_at: row.created_at, read: row.read, announcement_id: row.announcement_id }));
    return { items, total: items.length, unread: items.filter((row) => !row.read).length };
  },

  "POST /notifications/read-all": (ctx) => {
    const user = me(ctx);
    for (const row of ctx.db.notifications) if (row.user_id === user.id) row.read = true;
    return { ok: true };
  },

  "GET /notifications/preferences": (ctx) => preferencesOf(ctx.db, me(ctx).id),
  "PUT /notifications/preferences": (ctx) => {
    const user = me(ctx);
    ctx.db.preferences[user.id] = body<{ bus_near_stop: boolean; delays: boolean; official: boolean }>(ctx);
    return ctx.db.preferences[user.id];
  },

  "GET /requests": (ctx) => {
    const user = me(ctx);
    const items = ctx.db.requests.filter((row) => row.student_id === user.id).map((row) => requestView(ctx.db, row, ctx));
    return { items, total: items.length };
  },

  "POST /requests": (ctx) => {
    const user = me(ctx);
    const input = body<
      | { type: "refund"; reason: string }
      | { type: "line_change"; reason: string; to_line_id: string; kind: "temporary" | "permanent"; until: string | null }
      | { type: "project_model"; reason: string; date: string; size: string }
      | { type: "guardian_change"; reason: string; field: "phone" | "name" | "both" }
    >(ctx);
    const open = ctx.db.requests.find((row) => row.student_id === user.id && row.status === "open");
    if (open) throw new MockError(409, ErrorCode.OpenRequestExists, open.id);
    const hasParent = parentsOf(ctx.db, user.id).length > 0;
    let row: RequestRow;
    const base = { id: nextId("R"), student_id: user.id, created_at: nowIso(), status: "open" as const, reason: input.reason, rejection_reason: null };
    if (input.type === "guardian_change") {
      row = { ...base, details: { type: "guardian_change", field: input.field }, steps: steps("transport") };
    } else {
      const sub = requireActive(ctx);
      if (input.type === "refund") {
        const week = ctx.db.term.current.week;
        const tier = ctx.db.term.refund_policy.find((item) => week >= item.from_week && (item.to_week === null || week <= item.to_week));
        const percent = tier?.deduction_percent ?? 0;
        const paid = sub.paid_amount ?? sub.price;
        row = {
          ...base,
          details: { type: "refund", paid, week, deduction_percent: percent, refund_amount: Math.round((paid * (100 - percent)) / 100) },
          steps: hasParent ? steps("parent", "transport", "finance") : steps("transport", "finance"),
        };
      } else if (input.type === "line_change") {
        const to = findLine(ctx.db, input.to_line_id);
        if (to.id === ridingLine(ctx.db, sub)) throw new MockError(400, ErrorCode.Validation, "same line");
        if (bookedSeats(ctx.db, to.id) >= lineCapacity(ctx.db, to)) throw new MockError(409, ErrorCode.SeatUnavailable);
        if (input.kind === "temporary" && (!input.until || input.until < today())) throw new MockError(400, ErrorCode.Validation, "until");
        row = {
          ...base,
          details: { type: "line_change", to_line_id: to.id, kind: input.kind, until: input.kind === "temporary" ? input.until : null },
          steps: hasParent ? steps("parent", "transport") : steps("transport"),
        };
      } else {
        if (input.date < today()) throw new MockError(400, ErrorCode.Validation, "date");
        row = { ...base, details: { type: "project_model", date: input.date, size: input.size }, steps: steps("transport") };
      }
    }
    ctx.db.requests.unshift(row);
    if (row.steps[0]?.actor === "parent") {
      notifyParents(ctx.db, user.id, both(`طالب ${tx(REQUEST_LABEL[row.details.type], "ar")} ومستني موافقتك (${row.id})`, `asked for a ${tx(REQUEST_LABEL[row.details.type], "en")} and needs your approval (${row.id})`));
    }
    audit(ctx.db, user, both(`طلب ${tx(REQUEST_LABEL[row.details.type], "ar")} ${row.id}`, `${tx(REQUEST_LABEL[row.details.type], "en")} request ${row.id}`));
    return requestView(ctx.db, row, ctx);
  },

  "POST /requests/{request_id}/parent-decision": (ctx) => {
    const user = me(ctx);
    const row = ctx.db.requests.find((item) => item.id === ctx.params.request_id);
    if (!row) throw notFound();
    if (!user.children.includes(row.student_id)) throw forbidden();
    const current = row.steps.find((step) => step.state === "current");
    if (current?.actor !== "parent") throw invalidState("not waiting for the parent");
    const { approve, reason } = body<{ approve: boolean; reason: string | null }>(ctx);
    decide(ctx, row, approve, reason);
    audit(ctx.db, user, both(`ولي الأمر ${approve ? "وافق على" : "رفض"} ${row.id}`, `Parent ${approve ? "approved" : "rejected"} ${row.id}`));
    return requestView(ctx.db, row, ctx);
  },

  "GET /admin/requests": (ctx) => {
    const user = me(ctx);
    const rows = ctx.db.requests.filter((row) => user.role !== Role.Finance || row.steps.some((step) => step.actor === "finance"));
    const items = rows
      .sort((a, b) => Number(b.status === "open") - Number(a.status === "open") || b.created_at.localeCompare(a.created_at))
      .map((row) => requestView(ctx.db, row, ctx));
    return { items, total: items.length };
  },

  "PATCH /admin/requests/{request_id}": (ctx) => {
    const user = me(ctx);
    const row = ctx.db.requests.find((item) => item.id === ctx.params.request_id);
    if (!row) throw notFound();
    const current = row.steps.find((step) => step.state === "current");
    if (!current || current.actor === "parent") throw invalidState("waiting for the parent");
    if (user.role !== Role.SuperAdmin && ROLE_STEP[user.role] !== current.actor) throw forbidden();
    const { approve, reason } = body<{ approve: boolean; reason: string | null }>(ctx);
    decide(ctx, row, approve, reason);
    audit(ctx.db, user, both(`${approve ? "موافقة على" : "رفض"} طلب ${row.id} (${studentName(ctx.db, row.student_id)})`, `${approve ? "Approved" : "Rejected"} request ${row.id} (${studentName(ctx.db, row.student_id)})`));
    return requestView(ctx.db, row, ctx);
  },

  "GET /complaints": (ctx) => {
    const user = me(ctx);
    const items = ctx.db.complaints.filter((row) => row.student_id === user.id).map((row) => ({ ...row, student_name: user.name }));
    return { items, total: items.length };
  },

  "POST /complaints": (ctx) => {
    const user = me(ctx);
    const input = body<{ category: Db["complaints"][number]["category"]; text: string }>(ctx);
    const sub = currentSubscription(ctx.db, user.id);
    const allowed = input.category === "payment" ? !!sub && LIVE.includes(sub.status) : sub?.status === "active";
    if (!allowed) throw new MockError(403, ErrorCode.SubscriptionRequired);
    const row = { id: nextId("C"), student_id: user.id, category: input.category, text: input.text, created_at: nowIso(), status: "new" as const, reply: null };
    ctx.db.complaints.unshift(row);
    feed(ctx.db, both(`شكوى جديدة من ${user.name}`, `New complaint from ${user.name}`));
    return { ...row, student_name: user.name };
  },

  "GET /admin/complaints": (ctx) => {
    const items = ctx.db.complaints.map((row) => ({ ...row, student_name: studentName(ctx.db, row.student_id) }));
    return { items, total: items.length };
  },

  "POST /admin/complaints/{complaint_id}/reply": (ctx) => {
    const user = me(ctx);
    const row = ctx.db.complaints.find((item) => item.id === ctx.params.complaint_id);
    if (!row) throw notFound();
    if (row.reply) throw invalidState("already answered");
    row.reply = body<{ reply: string }>(ctx).reply;
    row.status = "answered";
    notify(ctx.db, row.student_id, both(`إدارة النقل ردت على شكوتك ${row.id}`, `The transport office replied to your complaint ${row.id}`), "personal");
    audit(ctx.db, user, both(`رد على شكوى ${row.id}`, `Replied to complaint ${row.id}`));
    return { ...row, student_name: studentName(ctx.db, row.student_id) };
  },

  "POST /chat": (ctx) => ({ reply: chatReply(ctx, body<{ message: string }>(ctx).message) }),

  "PATCH /admin/term/booking": (ctx) => {
    const user = me(ctx);
    const { booking } = body<{ booking: "open" | "closed" }>(ctx);
    ctx.db.term.current.booking = booking;
    audit(ctx.db, user, both(`${booking === "open" ? "فتح" : "قفل"} الحجز لـ ${tx(ctx.db.term.current.name, "ar")}`, `${booking === "open" ? "Opened" : "Closed"} booking for ${tx(ctx.db.term.current.name, "en")}`));
    feed(ctx.db, both(booking === "open" ? "الحجز اتفتح" : "الحجز اتقفل", booking === "open" ? "Booking opened" : "Booking closed"));
    return termView(ctx.db, ctx);
  },

  "PUT /admin/term/next": (ctx) => {
    const user = me(ctx);
    const input = body<{ name: string; booking_opens_on: string; booking_closes_on: string; starts_on: string; announce: boolean }>(ctx);
    if (input.booking_opens_on < today()) throw new MockError(400, ErrorCode.Validation, "booking_opens_on");
    if (input.booking_closes_on <= input.booking_opens_on) throw new MockError(400, ErrorCode.Validation, "booking_closes_on");
    if (input.starts_on <= input.booking_closes_on) throw new MockError(400, ErrorCode.Validation, "starts_on");
    ctx.db.term.next = {
      name: input.name,
      booking_opens_on: input.booking_opens_on,
      booking_closes_on: input.booking_closes_on,
      starts_on: input.starts_on,
    };
    // Old term-opening notices would show wrong dates: remove them everywhere first.
    for (const row of ctx.db.announcements.filter((item) => item.is_term_opening)) removeAnnouncement(ctx.db, row.id);
    ctx.db.scheduled = ctx.db.scheduled.filter((row) => !row.is_term_opening);
    if (input.announce) {
      publishAnnouncement(ctx.db, {
        id: nextId("A"),
        kind: "official",
        title: both(`حجز ${input.name} هيفتح ${input.booking_opens_on}`, `${input.name} booking opens ${input.booking_opens_on}`),
        text: both(
          `باب الحجز هيفتح ${input.booking_opens_on} لحد ${input.booking_closes_on}، والأماكن بالأسبقية. التشغيل يبدأ ${input.starts_on}.`,
          `Booking opens ${input.booking_opens_on} and closes ${input.booking_closes_on}, first come first served. Buses start ${input.starts_on}.`,
        ),
        target: "all",
        delay_minutes: null,
        pinned: true,
        to_parents: true,
        published_at: nowIso(),
        author: user.name,
        is_term_opening: true,
      });
      ctx.db.scheduled.push({
        id: nextId("AS"),
        title: both(`باب الحجز فتح: ${input.name}`, `Booking is open: ${input.name}`),
        text: both("احجز مكانك دلوقتي من التطبيق قبل ما الأماكن تخلص.", "Book your seat in the app now, before the seats run out."),
        target: "all",
        publish_at: cairoIso(input.booking_opens_on, "09:00"),
        pinned: true,
        to_parents: true,
        author: user.name,
        is_term_opening: true,
      });
    }
    audit(ctx.db, user, both(`ضبط مواعيد ${input.name}`, `Set the dates for ${input.name}`));
    return termView(ctx.db, ctx);
  },
};

