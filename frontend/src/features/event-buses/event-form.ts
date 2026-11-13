import { BusType } from "@/features/lines/schema";
import { addCalendarDays, toLatinDigits } from "@/lib/format";
import {
  EVENT_BUSES_MAX,
  EVENT_DAYS_AHEAD_MAX,
  EVENT_PLACE_MIN_LENGTH,
  EVENT_SEATS_BY_BUS,
  EVENT_STUDENTS_MAX,
  EVENT_TITLE_MIN_LENGTH,
  EventKind,
  type CreateEventBody,
} from "./schema";

/** The new event request form, as typed. */
export interface EventFormValues {
  kind: EventKind;
  title: string;
  date: string;
  departsAt: string;
  returnsAt: string;
  pickup: string;
  destination: string;
  students: string;
  busType: BusType;
  buses: string;
  note: string;
}
export type EventFormField = keyof EventFormValues;

export const EMPTY_EVENT_FORM: EventFormValues = {
  kind: EventKind.MilitaryEducation,
  title: "",
  date: "",
  departsAt: "",
  returnsAt: "",
  pickup: "",
  destination: "",
  students: "",
  busType: BusType.LargeBus,
  buses: "",
  note: "",
};

/** A whole positive number typed with Latin or Arabic digits, else null. */
export function toCount(text: string): number | null {
  const value = Number(toLatinDigits(text.trim()));
  return text.trim() && Number.isInteger(value) && value > 0 ? value : null;
}

/** Enough buses of the chosen type to seat everyone. */
export function suggestedBuses(students: number | null, busType: BusType): number | null {
  return students ? Math.ceil(students / EVENT_SEATS_BY_BUS[busType]) : null;
}

/** Message keys under `desk.events.form`, with what they need. */
export type EventFormError =
  | { key: "titleRequired" | "dateRequired" | "departsRequired" | "returnsAfter" }
  | { key: "placeRequired" }
  | { key: "studentsRequired"; max: number }
  | { key: "busesRequired"; max: number }
  | { key: "notEnoughSeats"; count: number };

/** The same checks the server makes, so most mistakes are caught before sending. */
export function validateEventForm(
  values: EventFormValues,
  today: string,
): Partial<Record<EventFormField, EventFormError>> {
  const errors: Partial<Record<EventFormField, EventFormError>> = {};
  const firstDay = addCalendarDays(today, 1);
  const lastDay = addCalendarDays(today, EVENT_DAYS_AHEAD_MAX);
  if (values.title.trim().length < EVENT_TITLE_MIN_LENGTH) {
    errors.title = { key: "titleRequired" };
  }
  if (!values.date || values.date < firstDay || values.date > lastDay) {
    errors.date = { key: "dateRequired" };
  }
  if (!values.departsAt) errors.departsAt = { key: "departsRequired" };
  if (values.returnsAt && values.departsAt && values.returnsAt <= values.departsAt) {
    errors.returnsAt = { key: "returnsAfter" };
  }
  if (values.pickup.trim().length < EVENT_PLACE_MIN_LENGTH) {
    errors.pickup = { key: "placeRequired" };
  }
  if (values.destination.trim().length < EVENT_PLACE_MIN_LENGTH) {
    errors.destination = { key: "placeRequired" };
  }
  const students = toCount(values.students);
  if (!students || students > EVENT_STUDENTS_MAX) {
    errors.students = { key: "studentsRequired", max: EVENT_STUDENTS_MAX };
  }
  const buses = toCount(values.buses);
  if (!buses || buses > EVENT_BUSES_MAX) {
    errors.buses = { key: "busesRequired", max: EVENT_BUSES_MAX };
  } else if (students && buses * EVENT_SEATS_BY_BUS[values.busType] < students) {
    errors.buses = { key: "notEnoughSeats", count: suggestedBuses(students, values.busType) ?? 0 };
  }
  return errors;
}

/** The request body from a form that passed validateEventForm. */
export function toCreateEventBody(values: EventFormValues): CreateEventBody {
  return {
    kind: values.kind,
    title: values.title.trim(),
    event_date: values.date,
    departs_at: values.departsAt,
    returns_at: values.returnsAt || null,
    pickup: values.pickup.trim(),
    destination: values.destination.trim(),
    students_count: toCount(values.students) ?? 0,
    bus_type: values.busType,
    buses_requested: toCount(values.buses) ?? 0,
    note: values.note.trim() || null,
  };
}
