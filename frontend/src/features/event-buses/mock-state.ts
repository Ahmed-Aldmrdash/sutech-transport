import { addDays } from "@/lib/api/mock/cairo-clock";
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

const TRANSPORT_OFFICER: Name = { ar: "نادية سمير", en: "Nadia Samir" };
const COMPANY_DESK: Name = { ar: "مكتب أبو الهول", en: "Abu El Hol desk" };
const DAY_MS = 86_400_000;

/** Seeded requests, dated around today. */
function seedEvents(today: string, now: number): MockBusEvent[] {
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
      createdAt: now - DAY_MS,
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
      createdAt: now - 4 * DAY_MS,
      reply: {
        busIds: ["bus_spare_2", "bus_ln_03"],
        note: { ar: "السواقين هيكونوا هناك 7:30.", en: "The drivers will be there at 7:30." },
        by: COMPANY_DESK,
        at: now - 3 * DAY_MS,
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
      createdAt: now - 14 * DAY_MS,
      reply: {
        busIds: ["bus_spare_1", "bus_ln_05"],
        note: null,
        by: COMPANY_DESK,
        at: now - 12 * DAY_MS,
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
      createdAt: now - 2 * DAY_MS,
      reply: {
        busIds: [],
        note: {
          ar: "كل الباصات الاحتياطية عندها صيانة اليوم ده.",
          en: "All our spare buses are in maintenance that day.",
        },
        by: COMPANY_DESK,
        at: now - DAY_MS,
      },
    },
  ];
}

/** Every request: the seeds (unless changed since) and the ones the office made. */
export function allMockEvents(now = Date.now()): MockBusEvent[] {
  const seeds = seedEvents(todayInCairo(new Date(now)), now).filter(
    (seed) => !events.has(seed.eventId),
  );
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
