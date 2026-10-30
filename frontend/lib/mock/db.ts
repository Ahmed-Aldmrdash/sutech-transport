import type { Role } from "@/features/auth/roles";
import type { Localized } from "./localized";
import { buildSeed } from "./seed";

/* The mock server's tables. Shapes are internal; handlers turn rows into contract responses. */

export interface UserRow {
  id: string;
  role: Role;
  name: string;
  identifier: string;
  masked_phone: string | null;
  faculty: Localized | null;
  level: Localized | null;
  guardian_name: string | null;
  /** Parent accounts: linked student ids. */
  children: string[];
  active: boolean;
  /** Crew accounts: the line they work on. */
  line_id: string | null;
}

export interface StopRow {
  id: string;
  name: Localized;
  time: string;
  active: boolean;
  is_destination: boolean;
  lat: number;
  lng: number;
}

export interface LineRow {
  id: string;
  name: Localized;
  price: number;
  bus_id: string | null;
  stops: StopRow[];
}

export interface BusRow {
  id: string;
  plate: string;
  type: Localized;
  capacity: number;
  operator: "university" | "bus_company";
  driver_name: string | null;
  status: "ok" | "repair";
}

export interface AssignmentRow {
  kind: "today" | "temporary" | "permanent";
  line_id: string;
  until: string | null;
}

export interface SubscriptionRow {
  id: string;
  student_id: string;
  status: "reserved" | "pending_payment" | "active" | "expired" | "cancelled" | "refunded";
  line_id: string;
  stop_id: string;
  price: number;
  reserved_at: string;
  paid_amount: number | null;
  payment_method: "fawry" | "instapay" | "bank_transfer" | null;
  rejection_reason: string | null;
  assignment: AssignmentRow | null;
  fawry: { code: string; expires_at: string } | null;
}

export interface PaymentRow {
  id: string;
  student_id: string;
  subscription_id: string;
  amount: number;
  method: "fawry" | "instapay" | "bank_transfer";
  reference: string;
  created_at: string;
  status: "pending" | "approved" | "rejected";
  automatic: boolean;
  rejection_reason: string | null;
  receipt_image: string | null;
}

export interface AnnouncementRow {
  id: string;
  kind: "official" | "delay" | "bus_change" | "time_change" | "back_on_schedule" | "trip_cancelled" | "extra_departure";
  title: Localized | null;
  text: Localized;
  target: string;
  delay_minutes: number | null;
  pinned: boolean;
  to_parents: boolean;
  published_at: string;
  author: Localized;
  is_term_opening: boolean;
}

export interface ScheduledRow {
  id: string;
  title: Localized;
  text: Localized;
  target: string;
  publish_at: string;
  pinned: boolean;
  to_parents: boolean;
  author: Localized;
  is_term_opening: boolean;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  text: Localized;
  created_at: string;
  read: boolean;
  announcement_id: string | null;
  /** Lets the student's "delay alerts" preference mute operational alerts. */
  category: "operations" | "official" | "personal";
}

export interface AttendanceEventRow {
  student_id: string;
  date: string;
  type: "skipped" | "unskipped" | "boarded" | "arrived" | "checked_out" | "absent" | "return_boarded" | "return_arrived";
  at: string;
  detail: Localized | null;
  recorded_by: string | null;
}

export interface TripRow {
  id: string;
  line_id: string;
  date: string;
  direction: "outbound" | "return";
  state: "not_started" | "in_progress" | "ended";
  started_at: string | null;
  ended_at: string | null;
  bus_id: string;
  /** 0..1 along the route; advanced by the simulation while in progress. */
  progress: number;
  /** Lines other than the demo driver's run on their own. */
  simulated: boolean;
  riders: Record<string, { state: "boarded" | "checked_out" | "absent"; at: string; detail: Localized | null }>;
}

export interface DelayRow {
  minutes: number;
  reason: Localized;
  announcement_id: string;
}

export interface SosRow {
  id: string;
  kind: "medical" | "bus_issue" | "accident";
  status: "new" | "acknowledged" | "closed";
  trip_id: string;
  line_id: string;
  bus_id: string;
  note: string;
  position: { lat: number; lng: number } | null;
  created_at: string;
  ambulance_requested: boolean;
  replacement_bus_id: string | null;
  log: { at: string; text: Localized; by: string }[];
}

export interface RequestRow {
  id: string;
  student_id: string;
  created_at: string;
  status: "open" | "approved" | "rejected";
  reason: string;
  details:
    | { type: "refund"; paid: number; week: number; deduction_percent: number; refund_amount: number }
    | { type: "line_change"; to_line_id: string; kind: "temporary" | "permanent"; until: string | null }
    | { type: "project_model"; date: string; size: string }
    | { type: "guardian_change"; field: "phone" | "name" | "both" };
  steps: { actor: "parent" | "transport" | "finance"; state: "done" | "current" | "waiting" | "rejected"; at: string | null }[];
  rejection_reason: string | null;
}

export interface ComplaintRow {
  id: string;
  student_id: string;
  category: "delay" | "driver" | "cleanliness" | "air_conditioning" | "payment" | "other";
  text: string;
  created_at: string;
  status: "new" | "answered";
  reply: string | null;
}

export interface ViolationRow {
  id: string;
  student_id: string;
  type: "smoking" | "refused_card" | "damage" | "misconduct" | "other";
  description: string;
  photo: string | null;
  reported_by: string;
  created_at: string;
  status: "new" | "referred" | "dismissed";
}

export interface DepartureRow {
  id: string;
  time: string;
  line_id: string | null;
  bus_id: string;
  capacity: number;
  riders: string[];
  reason: Localized;
  status: "open" | "cancelled";
  lecture_id: string | null;
  date: string;
}

export interface LectureRow {
  id: string;
  group: Localized;
  ends_at: string;
  students: number;
  note: Localized | null;
}

export interface PermitRow {
  id: string;
  student_id: string;
  kind: "priority_seat" | "medical_leave" | "escort";
  from: string;
  to: string;
  issued_by: string;
  status: "active" | "revoked";
}

export interface EventRow {
  id: string;
  name: string;
  date: string;
  students: number;
  buses_needed: number;
  university_buses: string[];
  company_buses: number;
  status: "awaiting_company" | "confirmed" | "company_declined" | "cancelled";
}

export interface TermRow {
  current: { name: Localized; booking: "open" | "closed"; booking_closes_on: string; week: number };
  next: { name: Localized; booking_opens_on: string; booking_closes_on: string; starts_on: string } | null;
  refund_policy: { from_week: number; to_week: number | null; deduction_percent: number }[];
}

export interface Db {
  version: number;
  seeded_on: string;
  seq: Record<string, number>;
  users: UserRow[];
  sessions: Record<string, string>;
  otp: Record<string, { code: string; attempts: number }>;
  lines: LineRow[];
  buses: BusRow[];
  subscriptions: SubscriptionRow[];
  payments: PaymentRow[];
  term: TermRow;
  announcements: AnnouncementRow[];
  scheduled: ScheduledRow[];
  notifications: NotificationRow[];
  preferences: Record<string, { bus_near_stop: boolean; delays: boolean; official: boolean }>;
  attendance: AttendanceEventRow[];
  trips: TripRow[];
  delays: Record<string, DelayRow>;
  sos: SosRow[];
  requests: RequestRow[];
  complaints: ComplaintRow[];
  violations: ViolationRow[];
  departures: DepartureRow[];
  lectures: LectureRow[];
  permits: PermitRow[];
  events: EventRow[];
  audit: { at: string; actor: string; action: Localized }[];
  feed: { at: string; text: Localized }[];
}

export const DB_VERSION = 1;
const STORAGE_KEY = "sutech.mock-db";

let db: Db | null = null;

function load(): Db {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Db;
      if (parsed.version === DB_VERSION) return parsed;
    }
  } catch {
    // Corrupt or blocked storage: start fresh.
  }
  return buildSeed();
}

export function getDb(): Db {
  if (!db) db = typeof window === "undefined" ? buildSeed() : load();
  return db;
}

export function saveDb(): void {
  if (!db || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // Storage full or blocked: the demo keeps working in memory.
  }
}

export function resetDb(): void {
  db = buildSeed();
  saveDb();
}

export function nextId(prefix: string): string {
  const store = getDb();
  const value = store.seq[prefix] ?? 1;
  store.seq[prefix] = value + 1;
  return `${prefix}-${value}`;
}
