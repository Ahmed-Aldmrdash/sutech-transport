import { MockStorage, StoredMap } from "@/lib/api/mock/stored-map";
import type { ConductRule, ViolationOutcome } from "./schema";

/**
 * The mock server's memory of the violations the bus crews recorded, and what Student Affairs
 * did with each one. Kept per crew member in localStorage. The photos themselves aren't kept.
 */

export interface MockViolationStudent {
  studentId: string;
  nameAr: string;
  nameEn: string;
  identifier: string;
}

export interface MockViolationOffice {
  openedAt: number;
  openedBy: { ar: string; en: string };
  closedAt: number | null;
  closedBy: { ar: string; en: string } | null;
  outcome: ViolationOutcome | null;
  note: string | null;
}

export interface MockViolation {
  violationId: string;
  rule: ConductRule;
  student: MockViolationStudent | null;
  tripId: string | null;
  /** The crew's line when it was recorded. Missing on violations saved before phase 6. */
  lineId?: string;
  description: string;
  photoName: string;
  createdAt: number;
  /** Null until Student Affairs opens it. */
  office?: MockViolationOffice | null;
}

const violations = new StoredMap<MockViolation[]>("sut.mock.violations", MockStorage.Local);

const AFFAIRS_OFFICER = { ar: "عمر خالد", en: "Omar Khaled" };

/** Line 7's crew recorded these before the demo starts, so Student Affairs has work. */
const SEED_VIOLATIONS: Record<string, MockViolation[]> = {
  usr_supervisor_1: [
    {
      violationId: "vio_seed_1",
      rule: "noise",
      student: {
        studentId: "usr_student_2",
        nameAr: "سيف حسام لطفي",
        nameEn: "Seif Hossam Lotfy",
        identifier: "240100102",
      },
      tripId: null,
      lineId: "ln_07",
      description: "كان مشغّل فيديوهات بصوت عالي في طريق الرجوع، واتقاله مرتين يستخدم سماعات.",
      photoName: "seat-9.jpg",
      createdAt: Date.parse("2026-10-21T13:20:00Z"),
      office: {
        openedAt: Date.parse("2026-10-21T15:00:00Z"),
        openedBy: AFFAIRS_OFFICER,
        closedAt: Date.parse("2026-10-22T09:30:00Z"),
        closedBy: AFFAIRS_OFFICER,
        outcome: "warning",
        note: "أول مرة. اتنبه عليه شخصيًا ووقّع على قواعد السلوك.",
      },
    },
    {
      violationId: "vio_seed_3",
      rule: "smoking",
      student: {
        studentId: "usr_desk_55",
        nameAr: "حبيبة أشرف كمال",
        nameEn: "Habiba Ashraf Kamal",
        identifier: "240100155",
      },
      tripId: null,
      lineId: "ln_07",
      description: "كانت بتشرب فيب في الكراسي اللي ورا في طريق الرايح، واتقالها مرتين توقف.",
      photoName: "back-seats.jpg",
      createdAt: Date.parse("2026-11-10T06:40:00Z"),
      office: null,
    },
  ],
  usr_driver_1: [
    {
      violationId: "vio_seed_2",
      rule: "damage",
      student: null,
      tripId: null,
      lineId: "ln_07",
      description: "لقيت كسوة كرسي 14 متقطعة بموس بعد رحلة الرجوع.",
      photoName: "seat-14.jpg",
      createdAt: Date.parse("2026-11-09T14:05:00Z"),
      office: {
        openedAt: Date.parse("2026-11-10T08:00:00Z"),
        openedBy: AFFAIRS_OFFICER,
        closedAt: null,
        closedBy: null,
        outcome: null,
        note: null,
      },
    },
  ],
};

export function violationsOf(crewId: string): MockViolation[] {
  return violations.get(crewId) ?? SEED_VIOLATIONS[crewId] ?? [];
}

export function saveViolations(crewId: string, list: MockViolation[]): void {
  violations.set(crewId, list);
}

/** Every crew member who recorded something, stored or seeded. */
export function crewWithViolations(): string[] {
  return [...new Set([...violations.keys(), ...Object.keys(SEED_VIOLATIONS)])];
}

/** Test helper. */
export function resetViolationsMock(): void {
  violations.clear();
}
