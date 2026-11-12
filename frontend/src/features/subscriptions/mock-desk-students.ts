import { MOCK_ACCOUNTS } from "@/features/auth/mock-accounts";
import { Role } from "@/lib/auth/roles";

/**
 * Made-up students with no account in the demo, who give the office pages something to work
 * on: receipts waiting for finance, a refund, a line change, a model permit and complaints.
 * Their bookings, receipts and requests are seeded in the subscriptions and requests mocks.
 * Everything here is fake (IDs 2x01001xx, phones 0100000xxxx), as the privacy test requires.
 */
interface MockDeskStudent {
  id: string;
  nameAr: string;
  nameEn: string;
  identifier: string;
  facultyAr: string;
  facultyEn: string;
  level: number;
  phone: string;
  guardianNameAr: string;
  guardianNameEn: string;
  guardianPhone: string;
}

const AI = {
  facultyAr: "برنامج تكنولوجيا الذكاء الاصطناعي وعلوم البيانات",
  facultyEn: "Artificial Intelligence & Data Science Technology Program",
};
const CS = {
  facultyAr: "برنامج تكنولوجيا علوم الحاسب",
  facultyEn: "Computer Science Technology Program",
};

export const MOCK_DESK_STUDENTS: readonly MockDeskStudent[] = [
  {
    id: "usr_desk_51",
    nameAr: "نور عادل حمدي",
    nameEn: "Nour Adel Hamdy",
    identifier: "240100151",
    ...AI,
    level: 3,
    phone: "01000006151",
    guardianNameAr: "عادل حمدي",
    guardianNameEn: "Adel Hamdy",
    guardianPhone: "01000007151",
  },
  {
    id: "usr_desk_52",
    nameAr: "مصطفى أيمن صبري",
    nameEn: "Mostafa Ayman Sabry",
    identifier: "250100152",
    ...CS,
    level: 2,
    phone: "01000006152",
    guardianNameAr: "أيمن صبري",
    guardianNameEn: "Ayman Sabry",
    guardianPhone: "01000007152",
  },
  {
    id: "usr_desk_53",
    nameAr: "مريم سعد الدين",
    nameEn: "Mariam Saad El Din",
    identifier: "260100153",
    ...CS,
    level: 1,
    phone: "01000006153",
    guardianNameAr: "سعد الدين محمود",
    guardianNameEn: "Saad El Din Mahmoud",
    guardianPhone: "01000007153",
  },
  {
    id: "usr_desk_54",
    nameAr: "يوسف هاني رزق",
    nameEn: "Youssef Hany Rizk",
    identifier: "260100154",
    ...CS,
    level: 1,
    phone: "01000006154",
    guardianNameAr: "هاني رزق",
    guardianNameEn: "Hany Rizk",
    guardianPhone: "01000007154",
  },
  {
    id: "usr_desk_55",
    nameAr: "حبيبة أشرف كمال",
    nameEn: "Habiba Ashraf Kamal",
    identifier: "240100155",
    ...AI,
    level: 3,
    phone: "01000006155",
    guardianNameAr: "أشرف كمال",
    guardianNameEn: "Ashraf Kamal",
    guardianPhone: "01000007155",
  },
  {
    id: "usr_desk_56",
    nameAr: "حمزة طارق فؤاد",
    nameEn: "Hamza Tarek Fouad",
    identifier: "250100156",
    ...CS,
    level: 2,
    phone: "01000006156",
    guardianNameAr: "طارق فؤاد",
    guardianNameEn: "Tarek Fouad",
    guardianPhone: "01000007156",
  },
  {
    id: "usr_desk_57",
    nameAr: "سلمى وائل عزت",
    nameEn: "Salma Wael Ezzat",
    identifier: "240100157",
    ...AI,
    level: 4,
    phone: "01000006157",
    guardianNameAr: "وائل عزت",
    guardianNameEn: "Wael Ezzat",
    guardianPhone: "01000007157",
  },
  {
    id: "usr_desk_58",
    nameAr: "أدهم شريف منير",
    nameEn: "Adham Sherif Mounir",
    identifier: "250100158",
    ...CS,
    level: 2,
    phone: "01000006158",
    guardianNameAr: "شريف منير",
    guardianNameEn: "Sherif Mounir",
    guardianPhone: "01000007158",
  },
];

/** A student as the office sees them, whether a demo account or a made-up desk student. */
export interface MockStudentRecord {
  id: string;
  nameAr: string;
  nameEn: string;
  identifier: string;
  facultyAr: string | null;
  facultyEn: string | null;
  level: number | null;
  phone: string;
}

/** Every student the mock server knows: the demo accounts first, then the desk students. */
export function mockStudentRecords(): MockStudentRecord[] {
  const accounts = MOCK_ACCOUNTS.filter(
    ({ user, disabled }) => user.role === Role.Student && !disabled,
  ).map(({ user, phone }) => ({
    id: user.id,
    nameAr: user.name_ar ?? user.name,
    nameEn: user.name,
    identifier: user.identifier,
    facultyAr: user.faculty_ar ?? user.faculty ?? null,
    facultyEn: user.faculty ?? null,
    level: user.level ?? null,
    phone,
  }));
  const desk = MOCK_DESK_STUDENTS.map((student) => ({
    id: student.id,
    nameAr: student.nameAr,
    nameEn: student.nameEn,
    identifier: student.identifier,
    facultyAr: student.facultyAr,
    facultyEn: student.facultyEn,
    level: student.level,
    phone: student.phone,
  }));
  return [...accounts, ...desk];
}

export function findMockStudentRecord(studentId: string): MockStudentRecord | undefined {
  return mockStudentRecords().find((student) => student.id === studentId);
}
