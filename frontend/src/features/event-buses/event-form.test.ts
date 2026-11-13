import { describe, expect, it } from "vitest";
import { BusType } from "@/features/lines/schema";
import {
  EMPTY_EVENT_FORM,
  suggestedBuses,
  toCount,
  toCreateEventBody,
  validateEventForm,
  type EventFormValues,
} from "./event-form";

const TODAY = "2026-11-12";

const filled: EventFormValues = {
  ...EMPTY_EVENT_FORM,
  title: "Open Day",
  date: "2026-11-20",
  departsAt: "08:00",
  returnsAt: "14:00",
  pickup: "Main gate",
  destination: "Campus",
  students: "٩٠",
  busType: BusType.LargeBus,
  buses: "2",
};

describe("new event request form", () => {
  it("reads Arabic digits and refuses anything but a whole positive number", () => {
    expect(toCount("٩٠")).toBe(90);
    expect(toCount("12")).toBe(12);
    expect(toCount("")).toBeNull();
    expect(toCount("0")).toBeNull();
    expect(toCount("2.5")).toBeNull();
  });

  it("suggests enough buses for the students", () => {
    expect(suggestedBuses(90, BusType.LargeBus)).toBe(2);
    expect(suggestedBuses(29, BusType.Coaster)).toBe(2);
    expect(suggestedBuses(null, BusType.Coaster)).toBeNull();
  });

  it("accepts a complete request and builds its body", () => {
    expect(validateEventForm(filled, TODAY)).toEqual({});
    const body = toCreateEventBody({ ...filled, returnsAt: "", note: "  " });
    expect(body.students_count).toBe(90);
    expect(body.returns_at).toBeNull();
    expect(body.note).toBeNull();
  });

  it("flags every missing or wrong field", () => {
    const errors = validateEventForm(EMPTY_EVENT_FORM, TODAY);
    expect(Object.keys(errors).sort()).toEqual(
      ["buses", "date", "departsAt", "destination", "pickup", "students", "title"].sort(),
    );
    expect(validateEventForm({ ...filled, date: TODAY }, TODAY).date?.key).toBe("dateRequired");
    expect(validateEventForm({ ...filled, returnsAt: "07:00" }, TODAY).returnsAt?.key).toBe(
      "returnsAfter",
    );
    expect(validateEventForm({ ...filled, buses: "1" }, TODAY).buses).toEqual({
      key: "notEnoughSeats",
      count: 2,
    });
  });
});
