import { addDays, cairoInstant, cairoOffsetOn } from "@/lib/api/mock/cairo-clock";
import { MockStorage, StoredMap } from "@/lib/api/mock/stored-map";
import { todayInCairo } from "@/lib/format";
import { BusType } from "@/features/lines/schema";
import { EventKind, EventStatus } from "./schema";

/**
 * The mock server's memory of the event bus requests. Seeded requests sit a few days around
 * today, so the demo always has one waiting for Abu El Hol, one confirmed and one in the past.
 * Once someone acts on one, it is stored with its real date.
 */

export type Name = { ar: string; en: string };

/** What a person typed: the same text whatever the reader's language. */
export const typed = (text: string): Name => ({ ar: text, en: text });

export interface MockBusEvent {
  eventId: string;
  number: number;
  kind: EventKind;
  /** Free text is kept in both languages; what a person typed is the same in both. */
  title: Name;
  eventDate: string;
  departsAt: string;
  returnsAt: string | null;
  pickup: Name;
  destination: Name;
  studentsCount: number;
  busType: BusType;
  busesRequested: number;
  note: Name | null;
  status: EventStatus;
  requestedBy: Name;
  createdAt: number;
  reply: { busIds: string[]; note: Name | null; by: Name; at: number } | null;
  cancellation: { reason: Name; by: Name; at: number } | null;
}

const events = new StoredMap<MockBusEvent>("sut.mock.busEvents", MockStorage.Local);

/** TRN-1001: the Transportation office asks Abu El Hol for event buses. */
const TRANSPORT_OFFICER: Name = { ar: "كريم فتحي", en: "Karim Fathy" };
const COMPANY_DESK: Name = { ar: "مكتب أبو الهول", en: "Abu El Hol desk" };

/**
 * Seeded requests, dated around today. Their times are fixed office hours N days back, so a
 * reload shows the same "asked at" time (they used to move with the clock).
 */
function seedEvents(today: string): MockBusEvent[] {
  const daysAgoAt = (days: number, clock: string) => {
    const day = addDays(today, -days);
    return cairoInstant(day, clock, cairoOffsetOn(day));
  };
  const base = {
    note: null,
    requestedBy: TRANSPORT_OFFICER,
    reply: null,
    cancellation: null,
    returnsAt: null,
  };
  return [
    {
      ...base,
      eventId: "evt_seed_1",
      number: 1,
      kind: EventKind.MilitaryEducation,
      title: { ar: "التربية العسكرية - الدفعة الأولى", en: "Military education - first group" },
      eventDate: addDays(today, 3),
      departsAt: "07:30",
      returnsAt: "15:00",
      pickup: { ar: "بوابة الجامعة الرئيسية", en: "University main gate" },
      destination: { ar: "مركز التدريب - طريق السويس", en: "Training centre - Suez Road" },
      studentsCount: 140,
      busType: BusType.LargeBus,
      busesRequested: 3,
      status: EventStatus.WaitingCompany,
      createdAt: daysAgoAt(1, "10:20"),
    },
    {
      ...base,
      eventId: "evt_seed_2",
      number: 2,
      kind: EventKind.OpenDay,
      title: { ar: "اليوم المفتوح 2026", en: "Open Day 2026" },
      eventDate: addDays(today, 9),
      departsAt: "08:00",
      returnsAt: "14:00",
      pickup: { ar: "ميدان رمسيس", en: "Ramses Square" },
      destination: { ar: "حرم الجامعة", en: "SUtech campus" },
      studentsCount: 90,
      busType: BusType.LargeBus,
      busesRequested: 2,
      status: EventStatus.Confirmed,
      createdAt: daysAgoAt(4, "11:05"),
      reply: {
        busIds: ["bus_spare_2", "bus_ln_03"],
        note: { ar: "السواقين هيكونوا هناك 7:30.", en: "The drivers will be there at 7:30." },
        by: COMPANY_DESK,
        at: daysAgoAt(3, "09:40"),
      },
    },
    {
      ...base,
      eventId: "evt_seed_3",
      number: 3,
      kind: EventKind.FieldTrip,
      title: { ar: "زيارة مصنع السويدي للكابلات", en: "Elsewedy Cables factory visit" },
      eventDate: addDays(today, -6),
      departsAt: "09:30",
      returnsAt: "16:00",
      pickup: { ar: "بوابة الجامعة الرئيسية", en: "University main gate" },
      destination: {
        ar: "المنطقة الصناعية - العاشر من رمضان",
        en: "Industrial zone - 10th of Ramadan",
      },
      studentsCount: 45,
      busType: BusType.Coaster,
      busesRequested: 2,
      status: EventStatus.Confirmed,
      createdAt: daysAgoAt(14, "12:30"),
      reply: {
        busIds: ["bus_spare_1", "bus_ln_05"],
        note: null,
        by: COMPANY_DESK,
        at: daysAgoAt(12, "10:15"),
      },
    },
    {
      ...base,
      eventId: "evt_seed_4",
      number: 4,
      kind: EventKind.Sports,
      title: { ar: "دوري الجامعات - مباراة كرة القدم", en: "University league - football match" },
      eventDate: addDays(today, 5),
      departsAt: "12:00",
      pickup: { ar: "الملاعب", en: "Sports grounds" },
      destination: { ar: "استاد القاهرة", en: "Cairo Stadium" },
      studentsCount: 30,
      busType: BusType.Coaster,
      busesRequested: 2,
      status: EventStatus.Declined,
      createdAt: daysAgoAt(2, "13:10"),
      reply: {
        busIds: [],
        note: {
          ar: "كل الباصات الاحتياطية عندها صيانة اليوم ده.",
          en: "All our spare buses are in maintenance that day.",
        },
        by: COMPANY_DESK,
        at: daysAgoAt(1, "09:25"),
      },
    },
  ];
}

/** Every request: the seeds (unless changed since) and the ones the office made. */
export function allMockEvents(now = Date.now()): MockBusEvent[] {
  const seeds = seedEvents(todayInCairo(new Date(now))).filter((seed) => !events.has(seed.eventId));
  return [...seeds, ...events.values()];
}

export function findMockEvent(eventId: string, now = Date.now()): MockBusEvent | undefined {
  return allMockEvents(now).find((item) => item.eventId === eventId);
}

export function saveMockEvent(event: MockBusEvent): void {
  events.set(event.eventId, event);
}

export function nextEventNumber(now = Date.now()): number {
  return Math.max(0, ...allMockEvents(now).map((item) => item.number)) + 1;
}

/** Test helper: back to the seeds. */
export function resetEventsMock(): void {
  events.clear();
}
