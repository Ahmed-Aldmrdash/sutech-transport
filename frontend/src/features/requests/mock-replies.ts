import { findMockLine, localized } from "@/features/lines/mock-builders";
import { formatCalendarDate, formatClockTime, formatMoney } from "@/lib/format";
import type { MockRequestPayload, MockText } from "./mock-state";
import { ComplaintCategory, RequestKind } from "./schema";

/**
 * Ready-made answers the office can send as they are or edit (the request desk fills the note
 * box with them). The real server can keep its own templates; the office always has the last
 * word on what the student reads.
 */

const TRANSPORT_ROOM = "A039";
const PAYOUT_DAYS = 45;
const PROCESSING_DAYS = 3;

interface MockReplies {
  open: MockText | null;
  approve: MockText | null;
  reject: MockText | null;
  resolve: MockText | null;
}

const NONE: MockReplies = { open: null, approve: null, reject: null, resolve: null };

/** "From Nov 8 to Nov 22" for a temporary change, "From Nov 8" for a permanent one, in words. */
function changePeriod(startsOn: string, endsOn: string | null): MockText {
  const from = { ar: formatCalendarDate(startsOn, "ar"), en: formatCalendarDate(startsOn, "en") };
  if (!endsOn) return { ar: `من يوم ${from.ar}`, en: `From ${from.en}` };
  const to = { ar: formatCalendarDate(endsOn, "ar"), en: formatCalendarDate(endsOn, "en") };
  return { ar: `من يوم ${from.ar} لحد يوم ${to.ar}`, en: `From ${from.en} to ${to.en}` };
}

const COMPLAINT_REPLY: Record<ComplaintCategory, MockText> = {
  [ComplaintCategory.DriverBehaviour]: {
    ar: "اتكلمنا مع السواق وشركة أبو الهول، واتنبه عليه. لو اتكرر بلغنا فورًا.",
    en: "We spoke to the driver and Abu El Hol, and he has been warned. Tell us at once if it happens again.",
  },
  [ComplaintCategory.Delay]: {
    ar: "راجعنا مواعيد الخط مع الشركة وهنتابع الوصول الأيام الجاية.",
    en: "We reviewed the line's timings with the bus company and will watch arrivals over the next days.",
  },
  [ComplaintCategory.BusCondition]: {
    ar: "بلغنا الشركة والباص هيتراجع (تكييف ونضافة وكراسي) قبل الأسبوع الجاي.",
    en: "We told the bus company; the bus (air conditioning, cleaning, seats) will be checked before next week.",
  },
  [ComplaintCategory.Crowding]: {
    ar: "راجعنا عدد المشتركين على الخط، وكل طالب ليه كرسي. المشرف هيتأكد من الكروت عند الركوب.",
    en: "We checked the line's subscribers: every student has a seat. The supervisor will check cards when boarding.",
  },
  [ComplaintCategory.Safety]: {
    ar: "شكرًا إنك بلغت. اتعمل تحقيق مع الشركة، ولو في خطر دلوقتي استخدم زر الطوارئ.",
    en: "Thank you for reporting it. We opened an investigation with the bus company. If you are in danger now, use the emergency button.",
  },
  [ComplaintCategory.Payment]: {
    ar: "راجعنا الإيصال في المالية. لو لسه في مشكلة، عدّي على مكتب الحسابات A045 ومعاك أصل الإيصال.",
    en: "We checked your receipt in Finance. If there is still a problem, visit the Accounting office, A045, with the original receipt.",
  },
  [ComplaintCategory.Other]: {
    ar: "شكرًا لملاحظتك، اتسجلت وبنتابعها.",
    en: "Thank you, your note is recorded and we are following it up.",
  },
};

/** The refund the office approves, in words, for the student. */
export function refundApprovedReply(piasters: number): MockText {
  return {
    ar:
      `تمت الموافقة على استرداد ${formatMoney(piasters, "ar")}. الشيك هيبقى باسم ولي ` +
      `الأمر في خلال ${PAYOUT_DAYS} يوم، وهنبلغك أول ما يجهز. الاشتراك اتلغى.`,
    en:
      `A refund of ${formatMoney(piasters, "en")} is approved. The cheque will be in your ` +
      `guardian's name within ${PAYOUT_DAYS} days; we'll tell you when it's ready. The ` +
      `subscription is cancelled.`,
  };
}

export function suggestedReplies(payload: MockRequestPayload): MockReplies {
  switch (payload.kind) {
    case RequestKind.LineChange: {
      const line = findMockLine(payload.toLineId);
      if (!line) return NONE;
      const [, stopAr = "", stopEn = ""] = line.stops[payload.toStopOrder - 1] ?? [];
      const period = changePeriod(payload.startsOn, payload.endsOn);
      return {
        open: {
          ar: "استلمنا الاستمارة بعد موافقة ولي الأمر، وبنشوف الأماكن على الخط.",
          en: "We got your form with your guardian's approval and are checking seats on the line.",
        },
        approve: {
          ar:
            `تمت الموافقة. ${period.ar} اركب خط ${line.code} (${localized("ar", line.nameAr, line.nameEn)}) ` +
            `من محطة ${stopAr}، ووري الكارت للمشرف زي العادي.`,
          en:
            `Approved. ${period.en}, ride line ${line.code} (${line.nameEn}) from ${stopEn}, and ` +
            `show your card to the supervisor as usual.`,
        },
        reject: {
          ar:
            `للأسف خط ${line.code} مليان دلوقتي ومفيش كرسي فاضي. جرّب خط فيه أماكن، أو ` +
            `كلمنا في مكتب ${TRANSPORT_ROOM}.`,
          en:
            `Sorry, line ${line.code} is full and has no free seat now. Try a line with free ` +
            `seats, or see us at office ${TRANSPORT_ROOM}.`,
        },
        resolve: null,
      };
    }
    case RequestKind.Refund:
      return {
        open: {
          ar:
            payload.estimatedRefundPiasters === null
              ? `بعتنا المستندات لإدارة الجامعة تقرر. هات أصل إيصال الدفع لمكتب النقل ` +
                `${TRANSPORT_ROOM}. القرار بياخد حوالي ${PROCESSING_DAYS} أيام عمل.`
              : `هات أصل إيصال الدفع لمكتب النقل ${TRANSPORT_ROOM}.`,
          en:
            payload.estimatedRefundPiasters === null
              ? `We sent your documents to the university administration to decide. Bring the ` +
                `original payment receipt to the Transportation office, ${TRANSPORT_ROOM}. A ` +
                `decision takes about ${PROCESSING_DAYS} working days.`
              : `Bring the original payment receipt to the Transportation office, ${TRANSPORT_ROOM}.`,
        },
        approve:
          payload.estimatedRefundPiasters === null
            ? null
            : refundApprovedReply(payload.estimatedRefundPiasters),
        reject: {
          ar: "للأسف الطلب ده مش بينطبق عليه سياسة الاسترداد. لو عندك مستندات تانية كلمنا.",
          en: "Sorry, this request doesn't meet the refund policy. Talk to us if you have other documents.",
        },
        resolve: null,
      };
    case RequestKind.Complaint:
      return { ...NONE, resolve: COMPLAINT_REPLY[payload.category] };
    case RequestKind.ModelPermit:
      return {
        open: {
          ar:
            `استلمنا التصريح، وبعتناه لـ ${payload.supervisorName} يوقّع عليه، وبعدها لإدارة ` +
            `السلامة (Safety).`,
          en:
            `We got your permit and sent it to ${payload.supervisorName} to sign, then to the ` +
            `Safety department.`,
        },
        approve: {
          ar:
            `إدارة السلامة وافقت. يوم ${formatCalendarDate(payload.entryDate, "ar")} الساعة ` +
            `${formatClockTime(payload.entryTime, "ar")} ورّي التصريح ده للسواق والمشرف قبل ما ` +
            `تركب، وخلّي المجسم بعيد عن الممر.`,
          en:
            `The Safety department approved it. On ${formatCalendarDate(payload.entryDate, "en")} ` +
            `at ${formatClockTime(payload.entryTime, "en")}, show this permit to the driver and ` +
            `supervisor before you board, and keep the model out of the aisle.`,
        },
        reject: {
          ar: "إدارة السلامة مش موافقة على المجسم ده في الباص. كلمنا لو محتاج حل تاني.",
          en: "The Safety department did not approve this model on the bus. Talk to us if you need another way.",
        },
        resolve: null,
      };
  }
}
