import { requireMockStudent } from "@/features/subscriptions/mock";
import { registerMock } from "@/lib/api/mock/mock-server";
import { askAssistantEndpoint } from "./api";
import type { AssistantAnswer } from "./schema";

/**
 * Mock only: a few answers from the university's transport documents, picked by keywords.
 * The real assistant (the AI team's) searches the documents and writes the answer.
 */
interface MockFaq {
  keywords: readonly string[];
  ar: string;
  en: string;
  sources: readonly [string, string][];
}

const FAQ: readonly MockFaq[] = [
  {
    keywords: ["price", "cost", "how much", "fee", "سعر", "بكام", "تمن", "مصاريف", "فلوس"],
    ar: "اشتراك الباص 15,000 جنيه للترم، نفس السعر لكل الخطوط.",
    en: "The bus subscription is EGP 15,000 per term, the same on every line.",
    sources: [["رد الجامعة: الأسعار", "University reply: prices"]],
  },
  {
    keywords: ["pay", "bank", "visa", "receipt", "دفع", "ادفع", "بنك", "فيزا", "إيصال", "ايصال"],
    ar: "تدفع بإيداع أو تحويل على حساب الجامعة في البنك الأهلي وترفع صورة الإيصال من صفحة الدفع، أو بالفيزا في مكتب A045. مفيش فوري ولا إنستاباي.",
    en: "Pay by deposit or transfer to the university's NBE account and upload the receipt on the Payment page, or by Visa at office A045. There is no Fawry or InstaPay.",
    sources: [["رد الجامعة: طرق الدفع", "University reply: payment"]],
  },
  {
    keywords: ["refund", "cancel", "استرداد", "استرجاع", "الغاء", "إلغاء"],
    ar: "الاسترداد بنسبة حسب وقت الطلب من بداية الترم، وبيحتاج موافقة ولي الأمر، والفلوس بترجع بشيك. قدّم الطلب من الطلبات ← استرداد.",
    en: "Refunds are a share of the price depending on when you ask in the term, need your guardian's approval and are paid by cheque. Apply from Requests → Refund.",
    sources: [["سياسة الاسترداد", "Refund policy"]],
  },
  {
    keywords: ["not going", "absent", "skip", "مش رايح", "مش هروح", "غياب", "غايب"],
    ar: 'من صفحة "مش رايح النهارده" بلّغ قبل ما الباص يتحرك من أول محطة. السواق ومكتب النقل بيتبلغوا، وولي أمرك بيوصله إشعار بس من غير موافقة.',
    en: 'Use "Not going today" before the bus leaves the first stop. The driver and the office are told, and your guardian only gets a notification, no approval needed.',
    sources: [["قواعد الركوب", "Riding rules"]],
  },
  {
    keywords: ["change line", "line change", "move", "تغيير", "اغير", "أغير", "خط تاني"],
    ar: "تغيير الخط بطلب من الطلبات ← تغيير خط. لازم ولي أمرك يوافق الأول، وبعدها مكتب النقل يراجعه لو فيه مكان.",
    en: "Ask from Requests → Line change. Your guardian approves first, then the Transportation office reviews it if there is a seat.",
    sources: [["استمارة تغيير الخط", "Line change form"]],
  },
  {
    keywords: ["card", "qr", "scan", "كارنيه", "كارت", "باركود"],
    ar: 'افتح "الكارنيه" ووريه للسواق أو المشرف وانت طالع. الكود بيتغير كل 30 ثانية، فالسكرين شوت مش بيشتغل.',
    en: 'Open "My card" and show it to the driver or supervisor as you board. The code changes every 30 seconds, so a screenshot won\'t work.',
    sources: [["قواعد الركوب", "Riding rules"]],
  },
  {
    keywords: [
      "return",
      "leave campus",
      "back",
      "4:30",
      "8:30",
      "time",
      "رجوع",
      "بيرجع",
      "مرواح",
      "روحة",
      "الساعة كام",
      "معاد",
      "ميعاد",
    ],
    ar: "كل الباصات بتوصل الجامعة 8:30 الصبح، وبترجع من الجامعة الساعة 4:30 العصر.",
    en: "Every bus reaches campus at 8:30 AM and leaves campus at 4:30 PM.",
    sources: [["مواعيد الخطوط", "Routes timetable"]],
  },
  {
    keywords: ["book", "booking", "seat", "register", "حجز", "احجز", "كرسي", "تسجيل"],
    ar: 'الحجز من "الخطوط والحجز" في الفترة اللي مكتب النقل فاتحها بس. بعد ما الحجز يقفل محدش يقدر يحجز حتى لو فيه أماكن، إلا لو الإدارة مدّت التسجيل.',
    en: 'Book from "Lines & booking" only while the Transportation office has booking open. Once it closes nobody can book, even with free seats, unless the office extends it.',
    sources: [["فترة الحجز", "Booking window"]],
  },
  {
    keywords: ["rule", "conduct", "food", "smoke", "قواعد", "سلوك", "أكل", "تدخين", "مخالفة"],
    ar: "ممنوع الأكل والتدخين والصوت العالي في الباص، والالتزام بالمحطة والمعاد. المخالفة بتتسجل وممكن توصل لإنذار أو إيقاف مؤقت.",
    en: "No food, smoking or loud noise on the bus; keep to your stop and time. Violations are recorded and can lead to a warning or a suspension.",
    sources: [["لائحة السلوك في باصات الجامعة", "Code of Conduct on University Buses"]],
  },
];

const ARABIC = /[؀-ۿ]/;

export function mockAnswer(question: string): AssistantAnswer {
  const text = question.toLowerCase();
  const arabic = ARABIC.test(question);
  const hit = FAQ.find((item) => item.keywords.some((word) => text.includes(word)));
  if (!hit) {
    return {
      answer: arabic
        ? "مش لاقي إجابة أكيدة في مستندات الجامعة. كلم مكتب النقل وهيساعدك."
        : "I couldn't find a sure answer in the university's documents. The Transportation office can help.",
      sources: [],
      needs_office: true,
    };
  }
  return {
    answer: arabic ? hit.ar : hit.en,
    sources: hit.sources.map(([ar, en]) => (arabic ? ar : en)),
    needs_office: false,
  };
}

registerMock(askAssistantEndpoint, ({ body }, { token }) => {
  requireMockStudent(token);
  return mockAnswer(body.question);
});
