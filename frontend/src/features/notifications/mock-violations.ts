import { firstNameOf } from "@/features/auth/user-text";
import { mockChildrenOf } from "@/features/children/mock-links";
import { localized } from "@/features/lines/mock-builders";
import {
  crewWithViolations,
  violationsOf,
  type MockViolation,
} from "@/features/violations/mock-state";
import { ViolationOutcome, type ConductRule } from "@/features/violations/schema";
import { cairoNow } from "@/lib/api/mock/cairo-clock";
import { formatCalendarDate } from "@/lib/format";
import { NotificationKind, NotificationTarget, type AppNotification } from "./schema";

/**
 * The mock's notice to a student, and to their guardian, when Student Affairs closes a bus
 * conduct report about them with a warning or an investigation. A dismissed report sends
 * nothing. The office's note is for the student's file, so it is not quoted.
 */

type Draft = Omit<AppNotification, "read_at">;

const RULE_NAME: Record<ConductRule, { ar: string; en: string }> = {
  unapproved_model: { ar: "مجسم من غير تصريح", en: "a project model without approval" },
  photographing: { ar: "تصوير راكب من غير إذنه", en: "photographing a passenger" },
  bullying: { ar: "تنمّر أو سخرية من راكب", en: "bullying or mocking a passenger" },
  cleanliness: { ar: "رجل على الكراسي أو أكل وشرب", en: "feet on seats, eating or drinking" },
  smoking: { ar: "تدخين", en: "smoking" },
  noise: { ar: "مزيكا أو أفلام بصوت عالي", en: "loud music or films" },
  unsafe_boarding: { ar: "ركوب أو نزول مش آمن", en: "unsafe boarding" },
  refused_id: { ar: "رفض يطلّع الكارنيه", en: "refusing to show the student ID" },
  bad_language: { ar: "ألفاظ أو تصرفات غير لائقة", en: "offensive language or behaviour" },
  not_subscribed: { ar: "ركوب من غير اشتراك", en: "riding without a subscription" },
  distracting_driver: { ar: "شغل السواق عن الطريق", en: "distracting the driver" },
  damage: { ar: "بوظان في الباص أو الكراسي", en: "damaging the bus or seats" },
  seating: { ar: "عدم الالتزام بمكان القعدة", en: "not keeping the assigned seat" },
  other: { ar: "مخالفة لقواعد الباص", en: "breaking the bus rules" },
};

interface Decision {
  violation: MockViolation;
  studentId: string;
  outcome: typeof ViolationOutcome.Warning | typeof ViolationOutcome.Investigation;
  closedAt: number;
}

function decisions(): Decision[] {
  return crewWithViolations().flatMap((crewId) =>
    violationsOf(crewId).flatMap((violation): Decision[] => {
      const office = violation.office;
      const outcome = office?.outcome;
      if (!violation.student || !office?.closedAt) return [];
      if (outcome !== ViolationOutcome.Warning && outcome !== ViolationOutcome.Investigation) {
        return [];
      }
      return [
        { violation, studentId: violation.student.studentId, outcome, closedAt: office.closedAt },
      ];
    }),
  );
}

/** "loud music or films on the bus, Oct 21" in both languages. */
function about(violation: MockViolation): { ar: string; en: string } {
  const rule = RULE_NAME[violation.rule];
  const day = cairoNow(new Date(violation.createdAt)).date;
  return {
    ar: `${rule.ar} في الباص يوم ${formatCalendarDate(day, "ar")}`,
    en: `${rule.en} on the bus, ${formatCalendarDate(day, "en")}`,
  };
}

export function studentViolationNotifications(studentId: string, language: string): Draft[] {
  return decisions()
    .filter((decision) => decision.studentId === studentId)
    .map(({ violation, outcome, closedAt }) => {
      const what = about(violation);
      const isWarning = outcome === ViolationOutcome.Warning;
      return {
        notification_id: `ntf_vio_${violation.violationId}`,
        kind: NotificationKind.ViolationDecision,
        title: isWarning
          ? localized(
              language,
              "شؤون الطلاب سجّلت إنذار في ملفك",
              "Student Affairs recorded a warning on your file",
            )
          : localized(
              language,
              "شؤون الطلاب حوّلت بلاغ عنك للتحقيق",
              "Student Affairs sent a report about you for investigation",
            ),
        body: isWarning
          ? localized(
              language,
              `بسبب ${what.ar}. لو عندك سؤال، كلّم شؤون الطلاب.`,
              `For ${what.en}. If you have a question, talk to Student Affairs.`,
            )
          : localized(
              language,
              `بسبب ${what.ar}. شؤون الطلاب هتتواصل معاك.`,
              `For ${what.en}. Student Affairs will contact you.`,
            ),
        created_at: new Date(closedAt).toISOString(),
        link: null,
      };
    });
}

export function guardianViolationNotifications(guardianId: string, language: string): Draft[] {
  const children = mockChildrenOf(guardianId);
  return decisions().flatMap(({ violation, studentId, outcome, closedAt }): Draft[] => {
    const child = children.find(({ user }) => user.id === studentId)?.user;
    if (!child) return [];
    const name = { ar: firstNameOf(child.name_ar ?? child.name), en: firstNameOf(child.name) };
    const what = about(violation);
    const isWarning = outcome === ViolationOutcome.Warning;
    return [
      {
        notification_id: `ntf_vio_${violation.violationId}_${guardianId}`,
        kind: NotificationKind.ViolationDecision,
        title: isWarning
          ? localized(
              language,
              `شؤون الطلاب سجّلت إنذار لـ ${name.ar}`,
              `Student Affairs warned ${name.en}`,
            )
          : localized(
              language,
              `بلاغ عن ${name.ar} اتحوّل للتحقيق`,
              `A report about ${name.en} went to investigation`,
            ),
        body: localized(
          language,
          `بسبب ${what.ar}. لو عندك سؤال، كلّم شؤون الطلاب.`,
          `For ${what.en}. If you have a question, talk to Student Affairs.`,
        ),
        created_at: new Date(closedAt).toISOString(),
        link: { target: NotificationTarget.ChildDay, id: studentId },
      },
    ];
  });
}
