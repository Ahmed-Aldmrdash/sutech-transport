import { describe, expect, it } from "vitest";
import { mockAnswer } from "./mock";

describe("assistant mock", () => {
  it("answers in the question's language", () => {
    expect(mockAnswer("الاشتراك بكام؟").answer).toContain("15,000");
    expect(mockAnswer("How much is the subscription?").answer).toContain("EGP 15,000");
  });

  it("knows the return time and the not-going rule", () => {
    expect(mockAnswer("الباص بيرجع من الجامعة الساعة كام؟").answer).toContain("4:30");
    expect(mockAnswer("I'm not going today, what do I do?").answer).toContain("no approval");
  });

  it("sends the student to the office when it has no answer", () => {
    expect(mockAnswer("what is the meaning of life").needs_office).toBe(true);
  });
});
