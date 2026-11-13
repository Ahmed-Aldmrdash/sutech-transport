import type { MockRequest } from "./mock-state";

/**
 * Requests from the made-up desk students (subscriptions/mock-desk-students.ts), so the
 * Transportation office and finance open their pages to real work: a line change the guardian
 * approved, a model permit, two complaints and an exceptional refund. Mock only.
 */
export const DESK_SEED_REQUESTS: Record<string, MockRequest[]> = {
  usr_desk_52: [
    {
      requestId: "req_desk_52",
      reference: "REQ-2026-0036",
      submittedAt: Date.parse("2026-11-10T10:00:00Z"),
      withdrawnAt: null,
      office: null,
      appliedAt: null,
      payload: {
        kind: "complaint",
        category: "payment",
        lineId: null,
        happenedOn: "2026-11-09",
        description:
          "أول تحويل اترفض بس الفلوس اتخصمت من حساب بابا. رفعت الرقم الصح تاني؛ ياريت " +
          "تراجعوه بسرعة، الحجز بيخلص بكرة.",
        attachments: [],
      },
    },
  ],
  usr_desk_55: [
    {
      requestId: "req_desk_55",
      reference: "REQ-2026-0037",
      submittedAt: Date.parse("2026-11-10T08:20:00Z"),
      withdrawnAt: null,
      office: null,
      appliedAt: null,
      payload: {
        kind: "refund",
        subscriptionId: "sub_desk_55",
        reason: "medical",
        explanation:
          "عملت عملية في الركبة والدكتور قال ممنوع سلالم أو مشاوير طويلة لمدة شهرين. أهلي " +
          "هيوصلوني لحد ما أخف.",
        paidPiasters: 1_500_000,
        deductionPercent: 100,
        estimatedRefundPiasters: null,
        guardianName: "Ashraf Kamal",
        guardianPhone: "01000007155",
        attachments: [
          {
            attachmentId: "att_desk_55",
            fileName: "medical-report.pdf",
            contentType: "application/pdf",
            sizeBytes: 412_000,
          },
        ],
      },
    },
  ],
  usr_desk_56: [
    {
      requestId: "req_desk_56",
      reference: "REQ-2026-0038",
      submittedAt: Date.parse("2026-11-11T16:30:00Z"),
      withdrawnAt: null,
      office: null,
      appliedAt: null,
      guardian: {
        hasAccount: false,
        decidedAt: Date.parse("2026-11-11T18:05:00Z"),
        approved: true,
        note: null,
      },
      payload: {
        kind: "line_change",
        fromLineId: "ln_04",
        toLineId: "ln_06",
        toStopOrder: 1,
        duration: "permanent",
        startsOn: "2026-11-22",
        endsOn: null,
        reason: "أهلي نقلوا الرحاب الشهر ده، وخط 4 مبقاش بيعدي جنب البيت.",
        studentPhone: "01000006156",
        guardianName: "Tarek Fouad",
        guardianPhone: "01000007156",
      },
    },
  ],
  usr_desk_57: [
    {
      requestId: "req_desk_57",
      reference: "REQ-2026-0039",
      submittedAt: Date.parse("2026-11-12T09:00:00Z"),
      withdrawnAt: null,
      office: null,
      appliedAt: null,
      payload: {
        kind: "model_permit",
        student: {
          name: { ar: "سلمى وائل عزت", en: "Salma Wael Ezzat" },
          universityId: "240100157",
          faculty: {
            ar: "برنامج تكنولوجيا الذكاء الاصطناعي وعلوم البيانات",
            en: "Artificial Intelligence & Data Science Technology Program",
          },
          level: 4,
        },
        lineId: "ln_09",
        material: "Wood and acrylic",
        dimensions: "60 × 40 × 30 cm",
        purpose: "display",
        purposeOther: null,
        destination: "Graduation project exhibition, hall B",
        entryDate: "2026-11-19",
        entryTime: "07:30",
        exitDate: "2026-11-19",
        exitTime: "15:30",
        supervisorName: "Dr. Rania Fawzy",
      },
    },
  ],
  usr_desk_58: [
    {
      requestId: "req_desk_58",
      reference: "REQ-2026-0040",
      submittedAt: Date.parse("2026-11-11T14:00:00Z"),
      withdrawnAt: null,
      office: {
        openedAt: Date.parse("2026-11-12T08:15:00Z"),
        openedBy: { ar: "كريم فتحي", en: "Karim Fathy" },
        openNote: null,
        decidedAt: null,
        decidedBy: null,
        decision: null,
        note: null,
        refundPiasters: null,
      },
      appliedAt: null,
      payload: {
        kind: "complaint",
        category: "driver_behaviour",
        lineId: "ln_12",
        happenedOn: "2026-11-11",
        description: "السواق كان ماسك الموبايل أغلب طريق الرجوع وكان سايق بسرعة على الدائري.",
        attachments: [],
      },
    },
  ],
};
