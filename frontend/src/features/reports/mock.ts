import { requireMockOffice } from "@/features/auth/mock-token";
import { mockRidersOf, type MockRider } from "@/features/crew/mock-state";
import {
  MOCK_SEATS_BY_BUS,
  MOCK_TERM_PRICE_PIASTERS,
  findMockLine,
  localized,
  toLineSummary,
} from "@/features/lines/mock-builders";
import { MOCK_LINES, type MockLineSource } from "@/features/lines/mock-lines";
import { LineErrorCode } from "@/features/lines/schema";
import { findMockStudentRecord } from "@/features/subscriptions/mock-desk-students";
import {
  bookingOf,
  paymentsOf,
  studentsWithPayments,
  type MockPayment,
} from "@/features/subscriptions/mock-state";
import { ServerErrorCode } from "@/lib/api/errors";
import { SERVICE_DAYS, addDays } from "@/lib/api/mock/cairo-clock";
import { MockHttpError, registerMock } from "@/lib/api/mock/mock-server";
import { Role } from "@/lib/auth/roles";
import { todayInCairo } from "@/lib/format";
import { getReportEndpoint, listReportsEndpoint } from "./api";
import {
  ATTENDANCE_MAX_DAYS,
  ColumnKind,
  REPORT_TYPES,
  ReportErrorCode,
  ReportType,
  canSeeReport,
  type ReportColumn,
  type ReportRow,
} from "./schema";

const HTTP = { Forbidden: 403, NotFound: 404, Unprocessable: 422 };
const DEFAULT_PAGE_SIZE = 50;
const READERS = [Role.Transport, Role.Finance, Role.SecretaryGeneral];
const PERCENT = 100;
/** Mock only: about one made-up rider in this many misses a given day. */
const ABSENT_ONE_IN = 9;
/** Mock only: about one made-up rider in this many said "not going" that day. */
const NOT_GOING_ONE_IN = 14;
/** Mock only: made-up riders paid between the start of bookings and this day. */
const FILLER_PAID_FROM = "2026-08-20";
const FILLER_PAID_DAYS = 80;
const FILLER_RECEIPT_ONE_IN = 3;

type Text = readonly [ar: string, en: string];

const TITLES: Record<ReportType, { title: Text; description: Text }> = {
  [ReportType.Roster]: {
    title: ["كشف المشتركين", "Subscribers roster"],
    description: [
      "كل طالب مشترك على كل خط، بمحطته وميعاد ركوبه.",
      "Every subscribed student on each line, with their stop and pickup time.",
    ],
  },
  [ReportType.Payments]: {
    title: ["تقرير المدفوعات", "Payments report"],
    description: [
      "الإيصالات والدفع بالفيزا في الفترة، بالمبلغ والحالة.",
      "Receipts and Visa payments in the period, with amount and status.",
    ],
  },
  [ReportType.Attendance]: {
    title: ["تقرير الحضور", "Attendance report"],
    description: [
      "مين ركب ومين غاب كل يوم على كل خط (شهر بالكتير).",
      "Who rode and who missed the bus each day on each line (a month at most).",
    ],
  },
  [ReportType.SeatOccupancy]: {
    title: ["إشغال الكراسي", "Seat occupancy"],
    description: [
      "عدد الكراسي والمشتركين ومتوسط الركاب لكل خط في الفترة.",
      "Seats, subscribers and average riders per line in the period.",
    ],
  },
};

const PAYMENT_METHOD: Record<MockPayment["method"], Text> = {
  bank_deposit: ["إيداع بنكي", "Bank deposit"],
  bank_transfer: ["تحويل بنكي", "Bank transfer"],
  card_at_office: ["فيزا في مكتب A045", "Visa at office A045"],
};

const PAYMENT_STATUS: Record<MockPayment["status"], Text> = {
  pending_review: ["مستني المراجعة", "Waiting for review"],
  approved: ["اتقبل", "Approved"],
  rejected: ["اترفض", "Rejected"],
};

function hashOf(text: string): number {
  let hash = 0;
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash;
}

function weekdayOf(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
}

function serviceDays(from: string, to: string): string[] {
  const days: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    if (SERVICE_DAYS.has(weekdayOf(day))) days.push(day);
  }
  return days;
}

interface Period {
  from: string;
  to: string;
}

/** Without a period the server uses this month so far (attendance: this week so far). */
function periodOf(type: ReportType, from: string | undefined, to: string | undefined): Period {
  const today = todayInCairo();
  const defaultFrom =
    type === ReportType.Attendance ? addDays(today, -weekdayOf(today)) : `${today.slice(0, 7)}-01`;
  const period = { from: from ?? (to && to < defaultFrom ? to : defaultFrom), to: to ?? today };
  if (period.to < period.from) {
    throw new MockHttpError(
      HTTP.Unprocessable,
      ReportErrorCode.InvalidRange,
      "The end is before the start.",
    );
  }
  if (
    type === ReportType.Attendance &&
    daysBetween(period.from, period.to) >= ATTENDANCE_MAX_DAYS
  ) {
    throw new MockHttpError(
      HTTP.Unprocessable,
      ReportErrorCode.RangeTooLong,
      "Attendance covers a month at most.",
    );
  }
  return period;
}

function linesOf(lineId: string | undefined): MockLineSource[] {
  if (!lineId) return [...MOCK_LINES];
  const line = findMockLine(lineId);
  if (!line) throw new MockHttpError(HTTP.NotFound, LineErrorCode.LineNotFound, "No such line.");
  return [line];
}

interface MockColumn {
  key: string;
  kind: ReportColumn["kind"];
  label: Text;
}

interface Built {
  columns: MockColumn[];
  rows: ReportRow[];
  summary: { label: Text; value: (language: string) => string }[];
}

const column = (key: string, kind: ReportColumn["kind"], label: Text): MockColumn => ({
  key,
  kind,
  label,
});

function numberIn(language: string, value: number): string {
  // Latin digits in Arabic too, as everywhere in the app.
  return new Intl.NumberFormat(language === "en" ? "en-US" : "ar-EG-u-nu-latn").format(value);
}

function stopOf(line: MockLineSource, order: number) {
  const [time = "", nameAr = "", nameEn = ""] = line.stops[order - 1] ?? [];
  return { time, nameAr, nameEn };
}

function roster(lines: MockLineSource[], language: string): Built {
  const rows: ReportRow[] = [];
  for (const line of lines) {
    for (const rider of mockRidersOf(line)) {
      const stop = stopOf(line, rider.stopOrder);
      rows.push({
        line: line.code,
        line_name: localized(language, line.nameAr, line.nameEn),
        identifier: rider.identifier,
        name: localized(language, rider.nameAr, rider.nameEn),
        stop: localized(language, stop.nameAr, stop.nameEn),
        pickup_time: stop.time,
      });
    }
  }
  return {
    columns: [
      column("line", ColumnKind.Text, ["الخط", "Line"]),
      column("line_name", ColumnKind.Text, ["اسم الخط", "Line name"]),
      column("identifier", ColumnKind.Text, ["الرقم الجامعي", "University ID"]),
      column("name", ColumnKind.Text, ["الاسم", "Name"]),
      column("stop", ColumnKind.Text, ["المحطة", "Stop"]),
      column("pickup_time", ColumnKind.Time, ["ميعاد الركوب", "Pickup time"]),
    ],
    rows,
    summary: [
      { label: ["الخطوط", "Lines"], value: (lang) => numberIn(lang, lines.length) },
      { label: ["المشتركين", "Subscribers"], value: (lang) => numberIn(lang, rows.length) },
    ],
  };
}

interface PaymentLine {
  paidOn: string;
  reference: string;
  identifier: string;
  nameAr: string;
  nameEn: string;
  line: MockLineSource;
  method: MockPayment["method"];
  amount: number;
  status: MockPayment["status"];
}

/** Mock only: every made-up rider paid once, on a fixed day after bookings opened. */
function fillerPayment(line: MockLineSource, rider: MockRider): PaymentLine {
  const seed = hashOf(`${rider.studentId}-paid`);
  const method: MockPayment["method"] =
    seed % FILLER_RECEIPT_ONE_IN === 0
      ? "card_at_office"
      : seed % 2 === 0
        ? "bank_deposit"
        : "bank_transfer";
  return {
    paidOn: addDays(FILLER_PAID_FROM, seed % FILLER_PAID_DAYS),
    reference: `${method === "card_at_office" ? "POS" : "NBE"}-${String(100000 + (seed % 899999))}`,
    identifier: rider.identifier,
    nameAr: rider.nameAr,
    nameEn: rider.nameEn,
    line,
    method,
    amount: MOCK_TERM_PRICE_PIASTERS,
    status: "approved",
  };
}

function allPaymentLines(lines: MockLineSource[]): PaymentLine[] {
  const lineIds = new Set(lines.map((line) => line.lineId));
  const result: PaymentLine[] = [];
  for (const studentId of studentsWithPayments()) {
    const student = findMockStudentRecord(studentId);
    const line = findMockLine(bookingOf(studentId)?.lineId ?? "");
    if (!student || !line || !lineIds.has(line.lineId)) continue;
    for (const payment of paymentsOf(studentId)) {
      result.push({
        paidOn: payment.paidOn,
        reference: payment.referenceNumber,
        identifier: student.identifier,
        nameAr: student.nameAr,
        nameEn: student.nameEn,
        line,
        method: payment.method,
        amount: payment.amountPiasters,
        status: payment.status,
      });
    }
  }
  for (const line of lines) {
    for (const rider of mockRidersOf(line)) {
      if (rider.studentId.startsWith("usr_filler_")) result.push(fillerPayment(line, rider));
    }
  }
  return result;
}

function payments(lines: MockLineSource[], period: Period, language: string): Built {
  const found = allPaymentLines(lines)
    .filter((item) => item.paidOn >= period.from && item.paidOn <= period.to)
    .sort((a, b) => b.paidOn.localeCompare(a.paidOn) || a.reference.localeCompare(b.reference));
  const approved = found.filter((item) => item.status === "approved");
  const collected = approved.reduce((sum, item) => sum + item.amount, 0);
  const waiting = found.filter((item) => item.status === "pending_review").length;
  return {
    columns: [
      column("paid_on", ColumnKind.Date, ["تاريخ الدفع", "Paid on"]),
      column("reference", ColumnKind.Text, ["رقم الإيصال", "Reference"]),
      column("identifier", ColumnKind.Text, ["الرقم الجامعي", "University ID"]),
      column("name", ColumnKind.Text, ["الاسم", "Name"]),
      column("line", ColumnKind.Text, ["الخط", "Line"]),
      column("method", ColumnKind.Text, ["طريقة الدفع", "Method"]),
      column("amount", ColumnKind.Money, ["المبلغ", "Amount"]),
      column("status", ColumnKind.Text, ["الحالة", "Status"]),
    ],
    rows: found.map((item) => ({
      paid_on: item.paidOn,
      reference: item.reference,
      identifier: item.identifier,
      name: localized(language, item.nameAr, item.nameEn),
      line: item.line.code,
      method: localized(language, ...PAYMENT_METHOD[item.method]),
      amount: item.amount,
      status: localized(language, ...PAYMENT_STATUS[item.status]),
    })),
    summary: [
      { label: ["عدد المدفوعات", "Payments"], value: (lang) => numberIn(lang, found.length) },
      {
        label: ["اللي اتحصّل", "Collected"],
        value: (lang) =>
          lang === "en"
            ? `EGP ${numberIn(lang, collected / PERCENT)}`
            : `${numberIn(lang, collected / PERCENT)} ج.م`,
      },
      { label: ["مستني المراجعة", "Waiting for review"], value: (lang) => numberIn(lang, waiting) },
    ],
  };
}

interface DayCount {
  date: string;
  line: MockLineSource;
  subscribers: number;
  rode: number;
  notGoing: number;
  absent: number;
}

/** Mock only: a made-up but steady count of who rode each line on each day. */
function dayCounts(lines: MockLineSource[], period: Period): DayCount[] {
  const today = todayInCairo();
  const counts: DayCount[] = [];
  for (const date of serviceDays(period.from, period.to > today ? today : period.to)) {
    for (const line of lines) {
      const riders = mockRidersOf(line, date);
      let notGoing = 0;
      let absent = 0;
      for (const rider of riders) {
        const seed = hashOf(`${rider.studentId}${date}`);
        if (seed % NOT_GOING_ONE_IN === 1) notGoing += 1;
        else if (seed % ABSENT_ONE_IN === 0) absent += 1;
      }
      counts.push({
        date,
        line,
        subscribers: riders.length,
        rode: riders.length - notGoing - absent,
        notGoing,
        absent,
      });
    }
  }
  return counts;
}

const percentOf = (part: number, whole: number) =>
  whole === 0 ? 0 : Math.round((part / whole) * PERCENT);

function attendance(lines: MockLineSource[], period: Period, language: string): Built {
  const counts = dayCounts(lines, period);
  const rode = counts.reduce((sum, item) => sum + item.rode, 0);
  const expected = counts.reduce((sum, item) => sum + item.subscribers, 0);
  const days = new Set(counts.map((item) => item.date)).size;
  return {
    columns: [
      column("date", ColumnKind.Date, ["اليوم", "Day"]),
      column("line", ColumnKind.Text, ["الخط", "Line"]),
      column("subscribers", ColumnKind.Number, ["المشتركين", "Subscribers"]),
      column("rode", ColumnKind.Number, ["ركبوا", "Rode"]),
      column("not_going", ColumnKind.Number, ["قالوا مش رايحين", "Said not going"]),
      column("absent", ColumnKind.Number, ["غابوا", "Absent"]),
      column("rate", ColumnKind.Percent, ["نسبة الحضور", "Attendance"]),
    ],
    rows: counts.map((item) => ({
      date: item.date,
      line: `${item.line.code} · ${localized(language, item.line.nameAr, item.line.nameEn)}`,
      subscribers: item.subscribers,
      rode: item.rode,
      not_going: item.notGoing,
      absent: item.absent,
      rate: percentOf(item.rode, item.subscribers),
    })),
    summary: [
      { label: ["أيام التشغيل", "Service days"], value: (lang) => numberIn(lang, days) },
      { label: ["رحلات ركوب", "Rides"], value: (lang) => numberIn(lang, rode) },
      {
        label: ["متوسط الحضور", "Average attendance"],
        value: (lang) => `${numberIn(lang, percentOf(rode, expected))}%`,
      },
    ],
  };
}

function seatOccupancy(lines: MockLineSource[], period: Period, language: string): Built {
  const counts = dayCounts(lines, period);
  const rows = lines.map((line) => {
    const seats = MOCK_SEATS_BY_BUS[line.busType];
    const subscribers = mockRidersOf(line).length;
    const days = counts.filter((item) => item.line.lineId === line.lineId);
    const average =
      days.length === 0
        ? 0
        : Math.round(days.reduce((sum, item) => sum + item.rode, 0) / days.length);
    return {
      line: line.code,
      line_name: localized(language, line.nameAr, line.nameEn),
      seats,
      subscribers,
      free_seats: Math.max(0, seats - subscribers),
      average_riders: average,
      occupancy: percentOf(average, seats),
    };
  });
  const seats = rows.reduce((sum, row) => sum + row.seats, 0);
  const subscribers = rows.reduce((sum, row) => sum + row.subscribers, 0);
  const riders = rows.reduce((sum, row) => sum + row.average_riders, 0);
  return {
    columns: [
      column("line", ColumnKind.Text, ["الخط", "Line"]),
      column("line_name", ColumnKind.Text, ["اسم الخط", "Line name"]),
      column("seats", ColumnKind.Number, ["الكراسي", "Seats"]),
      column("subscribers", ColumnKind.Number, ["المشتركين", "Subscribers"]),
      column("free_seats", ColumnKind.Number, ["كراسي فاضية", "Free seats"]),
      column("average_riders", ColumnKind.Number, [
        "متوسط الركاب في اليوم",
        "Average riders a day",
      ]),
      column("occupancy", ColumnKind.Percent, ["الإشغال", "Occupancy"]),
    ],
    rows,
    summary: [
      { label: ["الكراسي", "Seats"], value: (lang) => numberIn(lang, seats) },
      { label: ["المشتركين", "Subscribers"], value: (lang) => numberIn(lang, subscribers) },
      {
        label: ["متوسط الإشغال", "Average occupancy"],
        value: (lang) => `${numberIn(lang, percentOf(riders, seats))}%`,
      },
    ],
  };
}

registerMock(listReportsEndpoint, (_request, { token, language }) => {
  const { user } = requireMockOffice(token, READERS);
  return {
    items: REPORT_TYPES.filter((type) => canSeeReport(user.role, type)).map((type) => ({
      type,
      title: localized(language, ...TITLES[type].title),
      description: localized(language, ...TITLES[type].description),
      uses_period: type !== ReportType.Roster,
    })),
  };
});

registerMock(getReportEndpoint, ({ params, query }, { token, language }) => {
  const { user } = requireMockOffice(token, READERS);
  const type = params.type;
  if (!canSeeReport(user.role, type)) {
    throw new MockHttpError(HTTP.Forbidden, ServerErrorCode.Forbidden, "Not your report.");
  }
  const lines = linesOf(query.line);
  const period = type === ReportType.Roster ? null : periodOf(type, query.from, query.to);
  const built =
    type === ReportType.Roster
      ? roster(lines, language)
      : type === ReportType.Payments
        ? payments(lines, period as Period, language)
        : type === ReportType.Attendance
          ? attendance(lines, period as Period, language)
          : seatOccupancy(lines, period as Period, language);
  const page = query.page ?? 1;
  const pageSize = query.page_size ?? DEFAULT_PAGE_SIZE;
  const line = query.line ? findMockLine(query.line) : undefined;
  return {
    type,
    title: localized(language, ...TITLES[type].title),
    columns: built.columns.map((item) => ({
      key: item.key,
      kind: item.kind,
      label: localized(language, ...item.label),
    })),
    rows: built.rows.slice((page - 1) * pageSize, page * pageSize),
    total: built.rows.length,
    page,
    page_size: pageSize,
    filters: {
      line: line ? toLineSummary(line, language) : null,
      from: period?.from ?? null,
      to: period?.to ?? null,
    },
    summary: built.summary.map((item) => ({
      label: localized(language, ...item.label),
      value: item.value(language),
    })),
    generated_at: new Date().toISOString(),
  };
});
