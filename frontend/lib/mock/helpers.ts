import { Role } from "@/features/auth/roles";
import { ErrorCode } from "@/lib/api/errors";
import { formatMoney } from "@/lib/money";
import { addDays, nowIso, today } from "./clock";
import type { AnnouncementRow, Db, LineRow, NotificationRow, SubscriptionRow, UserRow } from "./db";
import { nextId } from "./db";
import { MockError, notFound } from "./errors";
import { emitMockLive } from "./live-bus";
import { type Localized, tx } from "./localized";
import { OTHER_BOOKINGS } from "./seed";

export interface Ctx {
  db: Db;
  user: UserRow | null;
  params: Record<string, string>;
  query: Record<string, string>;
  body: unknown;
  locale: string;
  t: (value: Localized) => string;
}

export const LIVE: readonly SubscriptionRow["status"][] = ["reserved", "pending_payment", "active"];
export const RESERVATION_HOURS = 24;

export function me(ctx: Ctx): UserRow {
  if (!ctx.user) throw new MockError(401, ErrorCode.Unauthorized);
  return ctx.user;
}

export function body<T>(ctx: Ctx): T {
  return ctx.body as T;
}

export function findLine(db: Db, id: string): LineRow {
  const line = db.lines.find((row) => row.id === id);
  if (!line) throw notFound();
  return line;
}

export function userById(db: Db, id: string): UserRow {
  const user = db.users.find((row) => row.id === id);
  if (!user) throw notFound();
  return user;
}

export function studentName(db: Db, id: string): string {
  return db.users.find((row) => row.id === id)?.name ?? id;
}

/** Expires unpaid reservations whose 24 hours ran out (the real server runs this as a job). */
export function expireReservations(db: Db): void {
  const cutoff = Date.now() - RESERVATION_HOURS * 3_600_000;
  for (const row of db.subscriptions) {
    if (row.status === "reserved" && new Date(row.reserved_at).getTime() < cutoff) row.status = "expired";
  }
}

export function currentSubscription(db: Db, studentId: string): SubscriptionRow | undefined {
  expireReservations(db);
  const rows = db.subscriptions.filter((row) => row.student_id === studentId);
  return rows.find((row) => LIVE.includes(row.status)) ?? rows.at(-1);
}

export function bookedSeats(db: Db, lineId: string): number {
  return (OTHER_BOOKINGS[lineId] ?? 0) + db.subscriptions.filter((row) => row.line_id === lineId && LIVE.includes(row.status)).length;
}

export function lineCapacity(db: Db, line: LineRow): number {
  return db.buses.find((bus) => bus.id === line.bus_id)?.capacity ?? 0;
}

/** The line a student rides today, after any transfer by the transport office. */
export function ridingLine(db: Db, row: SubscriptionRow): string {
  const assignment = row.assignment;
  if (!assignment) return row.line_id;
  if (assignment.kind === "permanent") return assignment.line_id;
  if (assignment.until && assignment.until >= today()) return assignment.line_id;
  return row.line_id;
}

export function activeStudentsOn(db: Db, lineId: string): SubscriptionRow[] {
  return db.subscriptions.filter((row) => row.status === "active" && ridingLine(db, row) === lineId);
}

export function requireActive(ctx: Ctx): SubscriptionRow {
  const row = currentSubscription(ctx.db, me(ctx).id);
  if (!row || row.status !== "active") throw new MockError(403, ErrorCode.SubscriptionRequired);
  return row;
}

export function parentsOf(db: Db, studentId: string): UserRow[] {
  return db.users.filter((user) => user.role === Role.Parent && user.children.includes(studentId));
}

export function preferencesOf(db: Db, userId: string) {
  return db.preferences[userId] ?? { bus_near_stop: true, delays: true, official: true };
}

export function notify(
  db: Db,
  userId: string,
  text: Localized,
  category: NotificationRow["category"],
  announcementId: string | null = null,
): void {
  const prefs = preferencesOf(db, userId);
  if (category === "operations" && !prefs.delays) return;
  if (category === "official" && !prefs.official) return;
  const row: NotificationRow = {
    id: nextId("N"),
    user_id: userId,
    text,
    created_at: nowIso(),
    read: false,
    announcement_id: announcementId,
    category,
  };
  db.notifications.unshift(row);
  emitMockLive("notification.new", { user_id: userId });
}

/** Notifies the student's parents with the student's first name in front. */
export function notifyParents(db: Db, studentId: string, text: Localized, announcementId: string | null = null): void {
  const first = studentName(db, studentId).split(" ")[0] ?? "";
  const prefixed: Localized =
    typeof text === "string" ? `${first}: ${text}` : { ar: `${first}: ${text.ar}`, en: `${first}: ${text.en}` };
  for (const parent of parentsOf(db, studentId)) notify(db, parent.id, prefixed, "personal", announcementId);
}

export function audit(db: Db, actor: UserRow | string, action: Localized): void {
  db.audit.unshift({ at: nowIso(), actor: typeof actor === "string" ? actor : actor.name, action });
}

export function feed(db: Db, text: Localized): void {
  db.feed.unshift({ at: nowIso(), text });
  db.feed = db.feed.slice(0, 40);
}

export function money(amount: number): Localized {
  return { ar: formatMoney(amount, "ar"), en: formatMoney(amount, "en") };
}

export function targetName(db: Db, target: string): Localized {
  if (target === "all") return { ar: "كل الخطوط", en: "All lines" };
  return db.lines.find((line) => line.id === target)?.name ?? target;
}

/** Recipients of an announcement: students who ride the target line(s) or hold a seat, and (optionally) their parents. */
export function announcementAudience(db: Db, row: AnnouncementRow): { students: string[]; parents: string[] } {
  const students = new Set<string>();
  for (const sub of db.subscriptions) {
    if (!LIVE.includes(sub.status)) continue;
    if (row.target === "all" || ridingLine(db, sub) === row.target || sub.line_id === row.target) students.add(sub.student_id);
  }
  if (row.kind === "official" && row.target === "all") {
    for (const user of db.users) if (user.role === Role.Student) students.add(user.id);
  }
  const parents = new Set<string>();
  if (row.to_parents) {
    for (const studentId of students) for (const parent of parentsOf(db, studentId)) parents.add(parent.id);
  }
  return { students: [...students], parents: [...parents] };
}

const KIND_LABEL: Record<AnnouncementRow["kind"], Localized> = {
  official: { ar: "إعلان رسمي", en: "Official announcement" },
  delay: { ar: "تأخير", en: "Delay" },
  bus_change: { ar: "تغيير باص", en: "Bus change" },
  time_change: { ar: "تغيير ميعاد", en: "Time change" },
  back_on_schedule: { ar: "رجوع للميعاد", en: "Back on schedule" },
  trip_cancelled: { ar: "إلغاء رحلة", en: "Trip cancelled" },
  extra_departure: { ar: "رحلة إضافية", en: "Extra trip" },
};

export function publishAnnouncement(db: Db, row: AnnouncementRow): AnnouncementRow {
  db.announcements.unshift(row);
  if (row.kind === "delay" && row.delay_minutes) {
    const lines = row.target === "all" ? db.lines.map((line) => line.id) : [row.target];
    for (const lineId of lines) db.delays[lineId] = { minutes: row.delay_minutes, reason: row.text, announcement_id: row.id };
  }
  const { students, parents } = announcementAudience(db, row);
  const label = KIND_LABEL[row.kind];
  const minutes = row.delay_minutes;
  const text: Localized =
    row.kind === "official"
      ? { ar: `${tx(label, "ar")}: ${tx(row.title ?? row.text, "ar")}`, en: `${tx(label, "en")}: ${tx(row.title ?? row.text, "en")}` }
      : {
          ar: `${tx(label, "ar")}${minutes ? ` ${minutes} دقيقة` : ""} (${tx(targetName(db, row.target), "ar")}): ${tx(row.text, "ar")}`,
          en: `${tx(label, "en")}${minutes ? ` ${minutes} min` : ""} (${tx(targetName(db, row.target), "en")}): ${tx(row.text, "en")}`,
        };
  const category = row.kind === "official" ? "official" : "operations";
  for (const id of students) notify(db, id, text, category, row.id);
  for (const id of parents) notify(db, id, text, "personal", row.id);
  emitMockLive("trip.status", { line_id: row.target });
  return row;
}

/** Deletes an announcement everywhere: the list, every notification it sent, and any delay it set. */
export function removeAnnouncement(db: Db, id: string): void {
  db.announcements = db.announcements.filter((row) => row.id !== id);
  db.notifications = db.notifications.filter((row) => row.announcement_id !== id);
  for (const [lineId, delay] of Object.entries(db.delays)) if (delay.announcement_id === id) delete db.delays[lineId];
}

export function nextTermStartsSoon(db: Db): boolean {
  return !!db.term.next && db.term.next.booking_opens_on <= addDays(today(), 0);
}
