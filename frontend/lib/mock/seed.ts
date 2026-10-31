import { Role } from "@/features/auth/roles";
import { addDays, cairoIso, minutesAgo, today } from "./clock";
import type { Db, LineRow, StopRow, SubscriptionRow, UserRow } from "./db";
import { both } from "./localized";

/** Bump when the seed or row shapes change, so browsers drop an old saved demo database. */
export const DB_VERSION = 2;

/*
 * Demo data. Students and the parent use the team's real names and university IDs (agreed with Ahmed);
 * no real phone numbers or emails anywhere. Staff accounts use the role names from the clickable demo.
 */

const FACULTY_AI = both("الذكاء الاصطناعي وعلوم البيانات", "AI & Data Science");
const FACULTY_CS = both("علوم الحاسب", "Computer Science");
const FACULTY_CYBER = both("الأمن السيبراني", "Cybersecurity");
const LEVEL_2 = both("الفرقة الثانية", "Year 2");
const LEVEL_3 = both("الفرقة الثالثة", "Year 3");

const GATE = { lat: 30.0405, lng: 32.493 };

function stop(id: string, ar: string, en: string, time: string, lat: number, lng: number): StopRow {
  return { id, name: both(ar, en), time, active: true, is_destination: false, lat, lng };
}

function gate(id: string, time: string): StopRow {
  return { id, name: both("بوابة الجامعة", "University gate"), time, active: true, is_destination: true, ...GATE };
}

const LINES: LineRow[] = [
  {
    id: "L1",
    name: both("خط السويس – الأربعين", "Suez – El Arbaeen"),
    price: 420000,
    bus_id: "B1",
    stops: [
      stop("L1-S1", "ميدان الأربعين", "El Arbaeen Square", "06:40", 29.9737, 32.5363),
      stop("L1-S2", "شارع الجيش", "El Geish Street", "06:50", 29.9792, 32.5268),
      stop("L1-S3", "الكورنيش الجديد", "New Corniche", "07:00", 29.9661, 32.5502),
      stop("L1-S4", "مستشفى السويس العام", "Suez General Hospital", "07:10", 29.9921, 32.5297),
      gate("L1-S5", "07:35"),
    ],
  },
  {
    id: "L2",
    name: both("خط الإسماعيلية", "Ismailia"),
    price: 560000,
    bus_id: "B2",
    stops: [
      stop("L2-S1", "محطة قطار الإسماعيلية", "Ismailia train station", "06:15", 30.5965, 32.2715),
      stop("L2-S2", "دوران الشيخ زايد", "El Sheikh Zayed roundabout", "06:25", 30.5831, 32.2894),
      stop("L2-S3", "فايد", "Fayed", "06:55", 30.3245, 32.2988),
      gate("L2-S4", "07:40"),
    ],
  },
  {
    id: "L3",
    name: both("خط فيصل – السلام", "Faisal – El Salam"),
    price: 380000,
    bus_id: "B3",
    stops: [
      stop("L3-S1", "حي فيصل", "Faisal district", "06:50", 29.9857, 32.5203),
      stop("L3-S2", "مساكن السلام", "El Salam housing", "07:00", 29.9958, 32.5101),
      stop("L3-S3", "سوق الأربعين", "El Arbaeen market", "07:10", 29.9731, 32.5401),
      gate("L3-S4", "07:30"),
    ],
  },
  {
    id: "L4",
    name: both("خط العين السخنة", "Ain Sokhna"),
    price: 620000,
    bus_id: "B4",
    stops: [
      stop("L4-S1", "منطقة الأدبية", "El Adabiya", "06:20", 29.8794, 32.4681),
      stop("L4-S2", "عتاقة", "Ataqa", "06:45", 29.9302, 32.4198),
      gate("L4-S3", "07:25"),
    ],
  },
];

const BUS_28 = both("ميني باص 28 راكب", "28-seat minibus");
const BUS_33 = both("باص 33 راكب", "33-seat bus");
const BUS_50 = both("باص 50 راكب", "50-seat bus");

interface StudentSeed {
  id: string;
  name: string;
  faculty: typeof FACULTY_AI;
  level: typeof LEVEL_2;
  line?: string;
  stop?: string;
  status?: SubscriptionRow["status"];
}

/** Team members (real names and IDs). Ahmed starts without a subscription so the whole booking flow can be tried. */
const STUDENTS: StudentSeed[] = [
  { id: "240102791", name: "أحمد محمد فتحي الدمرداش", faculty: FACULTY_AI, level: LEVEL_3 },
  { id: "240102684", name: "عمر أحمد رمضان رمضان", faculty: FACULTY_AI, level: LEVEL_3, line: "L1", stop: "L1-S3", status: "active" },
  { id: "250102519", name: "أبانوب رضا عبد السيد", faculty: FACULTY_AI, level: LEVEL_2, line: "L1", stop: "L1-S2", status: "active" },
  { id: "240102170", name: "شيماء حسين", faculty: FACULTY_CS, level: LEVEL_3, line: "L1", stop: "L1-S1", status: "active" },
  { id: "250101850", name: "عبد الله محمد أحمد", faculty: FACULTY_AI, level: LEVEL_2, line: "L2", stop: "L2-S3", status: "active" },
  { id: "250102374", name: "أحمد شفيق رجب", faculty: FACULTY_AI, level: LEVEL_2, line: "L2", stop: "L2-S2", status: "pending_payment" },
  { id: "250100665", name: "محمد نبيل عرفة", faculty: FACULTY_CS, level: LEVEL_2, line: "L3", stop: "L3-S2", status: "active" },
  { id: "240103524", name: "محمد علي محمد علي", faculty: FACULTY_CS, level: LEVEL_3, line: "L1", stop: "L1-S2", status: "refunded" },
  { id: "240102658", name: "محمود حمادة", faculty: FACULTY_CYBER, level: LEVEL_3, line: "L3", stop: "L3-S2", status: "active" },
  { id: "240100323", name: "معاذ عبد الجواد", faculty: FACULTY_AI, level: LEVEL_3, line: "L4", stop: "L4-S2", status: "active" },
];

/** Seats already sold to students outside this demo list, so the occupancy looks like a real term. */
export const OTHER_BOOKINGS: Record<string, number> = { L1: 20, L2: 44, L3: 26, L4: 17 };

function staff(id: string, role: Role, name: string, identifier: string, lineId: string | null = null): UserRow {
  return {
    id,
    role,
    name,
    identifier,
    masked_phone: "01•••••••42",
    faculty: null,
    level: null,
    guardian_name: null,
    children: [],
    active: true,
    line_id: lineId,
  };
}

export function buildSeed(): Db {
  const day = today();
  const yesterday = addDays(day, -1);

  const users: UserRow[] = [
    ...STUDENTS.map<UserRow>((student) => ({
      id: student.id,
      role: Role.Student,
      name: student.name,
      identifier: student.id,
      masked_phone: "010•••••907",
      faculty: student.faculty,
      level: student.level,
      guardian_name: student.id === "240102791" ? "محمد فتحي الدمرداش" : null,
      children: [],
      active: true,
      line_id: null,
    })),
    {
      ...staff("P-1", Role.Parent, "محمد فتحي الدمرداش", "parent-240102791"),
      masked_phone: "010•••••907",
      // Omar stands in for a second child so the children switcher can be tried.
      children: ["240102791", "240102684"],
    },
    staff("U-1", Role.SuperAdmin, "م. ياسر حسن", "admin"),
    staff("U-2", Role.TransportAdmin, "أ. خالد", "transport"),
    staff("U-3", Role.Finance, "منى عادل", "finance"),
    staff("U-4", Role.Clinic, "د. سامية", "clinic"),
    staff("U-5", Role.StudentAffairs, "أ. هشام", "affairs"),
    staff("U-6", Role.SecretaryGeneral, "مكتب الأمين العام", "secretary"),
    staff("U-7", Role.BusCompany, "شركة أبو الهول", "abulhoul"),
    staff("D-1", Role.Driver, "محمود عبد الرحمن", "driver", "L1"),
    staff("D-2", Role.Supervisor, "مشرف خط السويس", "supervisor", "L1"),
  ];

  const subscriptions: SubscriptionRow[] = STUDENTS.filter((student) => student.line && student.status).map(
    (student, index) => {
      const line = LINES.find((row) => row.id === student.line)!;
      const paid = student.status === "active" || student.status === "refunded";
      return {
        id: `SUB-${index + 1}`,
        student_id: student.id,
        status: student.status!,
        line_id: line.id,
        stop_id: student.stop!,
        price: line.price,
        reserved_at: student.status === "pending_payment" ? minutesAgo(180) : `${addDays(day, -40)}T08:00:00.000Z`,
        paid_amount: paid ? line.price : null,
        payment_method: paid ? "instapay" : student.status === "pending_payment" ? "instapay" : null,
        rejection_reason: null,
        assignment:
          student.id === "250101850" ? { kind: "temporary", line_id: "L4", until: addDays(day, 6) } : null,
        fawry: null,
      };
    },
  );

  const outboundTrip = (lineId: string, simulated: boolean, progress: number) => ({
    id: `T-${lineId}-${day}-out`,
    line_id: lineId,
    date: day,
    direction: "outbound" as const,
    state: simulated ? ("in_progress" as const) : ("not_started" as const),
    started_at: simulated ? minutesAgo(Math.round(progress * 50)) : null,
    ended_at: null,
    bus_id: LINES.find((line) => line.id === lineId)!.bus_id!,
    progress,
    simulated,
    riders: {},
  });

  return {
    version: DB_VERSION,
    seeded_on: day,
    seq: { SUB: 20, P: 1043, R: 225, C: 59, V: 89, A: 3, AS: 3, N: 10, D: 2, M: 2, E: 2, B: 8, L: 5, S: 4, U: 8, ST: 30 },
    users,
    sessions: {},
    otp: {},
    lines: LINES,
    buses: [
      { id: "B1", plate: "ن ص ق 4821", type: BUS_28, capacity: 28, operator: "university", driver_name: "محمود عبد الرحمن", status: "ok" },
      { id: "B2", plate: "س ع م 7310", type: BUS_50, capacity: 50, operator: "bus_company", driver_name: "سيد إبراهيم", status: "ok" },
      { id: "B3", plate: "ر ب ط 2296", type: BUS_28, capacity: 28, operator: "university", driver_name: "أحمد فوزي", status: "ok" },
      { id: "B4", plate: "ه و ل 9014", type: BUS_33, capacity: 33, operator: "bus_company", driver_name: "عادل منصور", status: "ok" },
      { id: "B5", plate: "ع ف ر 5530", type: BUS_50, capacity: 50, operator: "bus_company", driver_name: "رضا عبد العزيز", status: "ok" },
      { id: "B6", plate: "ط ي ب 3318", type: BUS_28, capacity: 28, operator: "university", driver_name: "حسن مرسي", status: "ok" },
      { id: "B7", plate: "م ج د 6402", type: BUS_33, capacity: 33, operator: "university", driver_name: null, status: "repair" },
    ],
    subscriptions,
    payments: [
      {
        id: "P-1042",
        student_id: "250102374",
        subscription_id: subscriptions.find((row) => row.student_id === "250102374")!.id,
        amount: 560000,
        method: "instapay",
        reference: "IPN58210933",
        created_at: minutesAgo(170),
        status: "pending",
        automatic: false,
        rejection_reason: null,
        receipt_image: null,
      },
      {
        id: "P-1040",
        student_id: "250100665",
        subscription_id: subscriptions.find((row) => row.student_id === "250100665")!.id,
        amount: 380000,
        method: "fawry",
        reference: "FWR 7731 0442",
        created_at: cairoIso(yesterday, "18:02"),
        status: "approved",
        automatic: true,
        rejection_reason: null,
        receipt_image: null,
      },
      {
        id: "P-1039",
        student_id: "240100323",
        subscription_id: subscriptions.find((row) => row.student_id === "240100323")!.id,
        amount: 620000,
        method: "bank_transfer",
        reference: "BNK-77310",
        created_at: cairoIso(yesterday, "15:40"),
        status: "approved",
        automatic: false,
        rejection_reason: null,
        receipt_image: null,
      },
    ],
    term: {
      current: {
        name: both("الترم الأول 2026/2027", "Fall term 2026/2027"),
        booking: "open",
        booking_closes_on: addDays(day, 16),
        week: 3,
      },
      next: {
        name: both("الترم التاني 2026/2027", "Spring term 2026/2027"),
        booking_opens_on: addDays(day, 32),
        booking_closes_on: addDays(day, 51),
        starts_on: addDays(day, 100),
      },
      refund_policy: [
        { from_week: 0, to_week: 0, deduction_percent: 0 },
        { from_week: 1, to_week: 2, deduction_percent: 10 },
        { from_week: 3, to_week: 6, deduction_percent: 25 },
        { from_week: 7, to_week: null, deduction_percent: 50 },
      ],
    },
    announcements: [
      {
        id: "A-1",
        kind: "delay",
        title: null,
        text: both("زحمة عند دوران فايد", "Traffic at the Fayed roundabout"),
        target: "L2",
        delay_minutes: 6,
        pinned: false,
        to_parents: true,
        published_at: minutesAgo(25),
        author: both("سائق خط الإسماعيلية", "Ismailia line driver"),
        is_term_opening: false,
      },
      {
        id: "A-2",
        kind: "official",
        title: both("حجز الترم التاني 2026/2027 هيفتح قريب", "Spring 2026/2027 booking opens soon"),
        text: both(
          "باب الحجز لاشتراكات الترم التاني هيفتح من التطبيق، والأماكن بالأسبقية. التاريخ بالظبط في كارت الترم في الرئيسية.",
          "Booking for spring subscriptions opens in the app, first come first served. The exact date is on the term card on your home screen.",
        ),
        target: "all",
        delay_minutes: null,
        pinned: true,
        to_parents: true,
        published_at: cairoIso(yesterday, "10:00"),
        author: both("إدارة النقل", "Transport office"),
        is_term_opening: true,
      },
    ],
    scheduled: [
      {
        id: "AS-1",
        title: both("باب الحجز فتح: الترم التاني 2026/2027", "Booking is open: Spring term 2026/2027"),
        text: both(
          "احجز مكانك دلوقتي من التطبيق قبل ما الأماكن تخلص.",
          "Book your seat in the app now, before the seats run out.",
        ),
        target: "all",
        publish_at: cairoIso(addDays(day, 32), "09:00"),
        pinned: true,
        to_parents: true,
        author: both("إدارة النقل", "Transport office"),
        is_term_opening: true,
      },
      {
        id: "AS-2",
        title: both("مواعيد باصات أسبوع الميدتيرم", "Bus times in midterm week"),
        text: both(
          "مواعيد الرجوع هتتغير أسبوع الميدتيرم حسب جدول الامتحانات، والجدول الكامل هيتنزل هنا.",
          "Return times change in midterm week to follow the exam timetable. The full timetable will be posted here.",
        ),
        target: "all",
        publish_at: cairoIso(addDays(day, 3), "09:00"),
        pinned: false,
        to_parents: true,
        author: both("إدارة النقل", "Transport office"),
        is_term_opening: false,
      },
    ],
    notifications: [
      {
        id: "N-1",
        user_id: "P-1",
        text: both(
          "إعلان رسمي: حجز الترم التاني 2026/2027 هيفتح قريب",
          "Official announcement: Spring 2026/2027 booking opens soon",
        ),
        created_at: cairoIso(yesterday, "10:00"),
        read: false,
        announcement_id: "A-2",
        category: "official",
      },
      {
        id: "N-2",
        user_id: "240102791",
        text: both(
          "إعلان رسمي: حجز الترم التاني 2026/2027 هيفتح قريب",
          "Official announcement: Spring 2026/2027 booking opens soon",
        ),
        created_at: cairoIso(yesterday, "10:00"),
        read: false,
        announcement_id: "A-2",
        category: "official",
      },
    ],
    preferences: {},
    attendance: [
      {
        student_id: "240102684",
        date: yesterday,
        type: "boarded",
        at: cairoIso(yesterday, "06:58"),
        detail: both("الكورنيش الجديد", "New Corniche"),
        recorded_by: "محمود عبد الرحمن",
      },
      { student_id: "240102684", date: yesterday, type: "arrived", at: cairoIso(yesterday, "07:36"), detail: null, recorded_by: null },
      { student_id: "240102170", date: day, type: "skipped", at: cairoIso(day, "06:05"), detail: null, recorded_by: null },
    ],
    trips: [outboundTrip("L1", false, 0), outboundTrip("L2", true, 0.55), outboundTrip("L3", true, 0.1), outboundTrip("L4", true, 0.7)],
    delays: { L2: { minutes: 6, reason: both("زحمة عند دوران فايد", "Traffic at the Fayed roundabout"), announcement_id: "A-1" } },
    sos: [
      {
        id: "S-3",
        kind: "bus_issue",
        status: "closed",
        trip_id: `T-L2-${yesterday}-out`,
        line_id: "L2",
        bus_id: "B2",
        note: "كاوتش نام قبل فايد",
        position: { lat: 30.2104, lng: 32.3311 },
        created_at: cairoIso(yesterday, "07:20"),
        ambulance_requested: false,
        replacement_bus_id: null,
        log: [
          { at: cairoIso(yesterday, "07:21"), text: both("الإدارة استلمت البلاغ", "Transport office acknowledged"), by: "أ. خالد" },
          { at: cairoIso(yesterday, "07:34"), text: both("الكاوتش اتغير والرحلة كملت", "Tyre changed, trip continued"), by: "أ. خالد" },
        ],
      },
    ],
    requests: [
      {
        id: "R-221",
        student_id: "240103524",
        created_at: cairoIso(addDays(day, -2), "11:00"),
        status: "approved",
        reason: "سفر للخارج",
        details: { type: "refund", paid: 380000, week: 3, deduction_percent: 25, refund_amount: 285000 },
        steps: [
          { actor: "parent", state: "done", at: cairoIso(addDays(day, -2), "12:00") },
          { actor: "transport", state: "done", at: cairoIso(addDays(day, -1), "09:00") },
          { actor: "finance", state: "done", at: cairoIso(addDays(day, -1), "09:20") },
        ],
        rejection_reason: null,
      },
      {
        id: "R-224",
        student_id: "250100665",
        created_at: cairoIso(yesterday, "13:00"),
        status: "open",
        reason: "مجسم مشروع تخرج",
        details: { type: "project_model", date: addDays(day, 2), size: "120×80 سم" },
        steps: [
          { actor: "parent", state: "done", at: cairoIso(yesterday, "14:00") },
          { actor: "transport", state: "current", at: null },
        ],
        rejection_reason: null,
      },
    ],
    complaints: [
      {
        id: "C-57",
        student_id: "250102519",
        category: "delay",
        text: "الباص اتأخر 25 دقيقة يوم الاتنين ومحدش بلغنا.",
        created_at: cairoIso(addDays(day, -9), "09:00"),
        status: "answered",
        reply: "بنعتذر عن التأخير بسبب عطل مفاجئ. من دلوقتي أي تأخير بيوصلك عليه إشعار تلقائي من التطبيق.",
      },
      {
        id: "C-58",
        student_id: "240102684",
        category: "air_conditioning",
        text: "التكييف في باص خط السويس مش شغال من أسبوع.",
        created_at: cairoIso(addDays(day, -8), "16:00"),
        status: "new",
        reply: null,
      },
    ],
    violations: [
      {
        id: "V-88",
        student_id: "250102519",
        type: "refused_card",
        description: "رفض يوري الكارنيه عند الركوب عند نقطة شارع الجيش.",
        photo: null,
        reported_by: "محمود عبد الرحمن",
        created_at: cairoIso(yesterday, "06:52"),
        status: "referred",
      },
    ],
    departures: [
      {
        id: "D-1",
        time: "13:30",
        line_id: null,
        bus_id: "B6",
        capacity: 28,
        riders: ["250102519", "240102170"],
        reason: both("انتهاء محاضرات الفرقة الثانية 1:15", "Year 2 lectures end at 1:15"),
        status: "open",
        lecture_id: "K2",
        date: day,
      },
    ],
    lectures: [
      { id: "K1", group: both("الفرقة الأولى", "Year 1"), ends_at: "12:30", students: 46, note: both("آخر محاضرة اتلغت", "Last lecture cancelled") },
      { id: "K2", group: LEVEL_2, ends_at: "13:15", students: 38, note: null },
      { id: "K3", group: LEVEL_3, ends_at: "15:00", students: 41, note: null },
      { id: "K4", group: both("الفرقة الرابعة", "Year 4"), ends_at: "16:30", students: 22, note: null },
    ],
    permits: [
      {
        id: "M-1",
        student_id: "240102170",
        kind: "priority_seat",
        from: addDays(day, -10),
        to: addDays(day, 4),
        issued_by: "د. سامية",
        status: "active",
      },
    ],
    events: [
      {
        id: "E-1",
        name: "التربية العسكرية",
        date: addDays(day, 7),
        students: 140,
        buses_needed: 3,
        university_buses: ["B6"],
        company_buses: 2,
        status: "awaiting_company",
      },
    ],
    audit: [
      { at: cairoIso(yesterday, "18:02"), actor: "فوري (تلقائي)", action: both("تأكيد دفع محمد نبيل عرفة – 3,800 ج.م", "Payment confirmed for محمد نبيل عرفة – EGP 3,800") },
      { at: cairoIso(yesterday, "15:41"), actor: "منى عادل", action: both("موافقة على إيصال معاذ عبد الجواد P-1039", "Approved receipt P-1039 (معاذ عبد الجواد)") },
      { at: cairoIso(yesterday, "09:20"), actor: "منى عادل", action: both("اعتماد استرداد R-221", "Refund R-221 approved") },
    ],
    feed: [
      { at: minutesAgo(25), text: both("باص خط الإسماعيلية متأخر 6 دقايق عند فايد", "Ismailia bus running 6 minutes late at Fayed") },
      { at: minutesAgo(48), text: both("بدأت رحلة الذهاب – خط الإسماعيلية", "Outbound trip started – Ismailia") },
      { at: cairoIso(yesterday, "15:41"), text: both("المالية وافقت على إيصال معاذ عبد الجواد", "Finance approved معاذ عبد الجواد's receipt") },
    ],
  };
}

