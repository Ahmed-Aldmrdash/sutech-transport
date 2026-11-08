import { Role } from "@/lib/auth/roles";
import type { User } from "./schema";

export interface MockAccount {
  user: User;
  /** The registered phone the code is "sent" to. */
  phone: string;
  disabled?: boolean;
}

/** Mock codes are 4 random digits, like the real SMS. */
export const MOCK_OTP_LENGTH = 4;

const account = (
  user: Omit<User, "masked_phone">,
  phone: string,
  options: { disabled?: boolean } = {},
): MockAccount => ({ user: { ...user, masked_phone: maskPhone(phone) }, phone, ...options });

export function maskPhone(phone: string): string {
  return `${phone.slice(0, 3)}•••••${phone.slice(-3)}`;
}

/**
 * One account per role, so every home and every guard can be tried without a server. The
 * names, IDs and phones are made up (no real person's data in any build); Seif is the active
 * subscriber. Every phone is 0100000xxxx, which a test enforces.
 */
export const MOCK_ACCOUNTS: readonly MockAccount[] = [
  account(
    {
      id: "usr_student_1",
      role: Role.Student,
      name: "Ziad Tamer Nour",
      name_ar: "زياد تامر نور",
      identifier: "240100101",
      faculty: "Artificial Intelligence & Data Science Technology Program",
      faculty_ar: "برنامج تكنولوجيا الذكاء الاصطناعي وعلوم البيانات",
      level: 3,
      guardian_name: "Tamer Nour",
      guardian_name_ar: "تامر نور",
    },
    "01000001001",
  ),
  account(
    {
      id: "usr_student_2",
      role: Role.Student,
      name: "Seif Hossam Lotfy",
      name_ar: "سيف حسام لطفي",
      identifier: "240100102",
      faculty: "Artificial Intelligence & Data Science Technology Program",
      faculty_ar: "برنامج تكنولوجيا الذكاء الاصطناعي وعلوم البيانات",
      level: 3,
      guardian_name: "Hossam Lotfy",
      guardian_name_ar: "حسام لطفي",
    },
    "01000001002",
  ),
  account(
    {
      id: "usr_student_3",
      role: Role.Student,
      name: "Mina Fady Samir",
      name_ar: "مينا فادي سمير",
      identifier: "250100103",
      faculty: "Artificial Intelligence & Data Science Technology Program",
      faculty_ar: "برنامج تكنولوجيا الذكاء الاصطناعي وعلوم البيانات",
      level: 2,
      guardian_name: "Fady Samir",
      guardian_name_ar: "فادي سمير",
    },
    "01000001003",
  ),
  account(
    {
      id: "usr_student_4",
      role: Role.Student,
      name: "Yahia Khaled Salem",
      name_ar: "يحيى خالد سالم",
      identifier: "250100104",
      faculty: "Artificial Intelligence & Data Science Technology Program",
      faculty_ar: "برنامج تكنولوجيا الذكاء الاصطناعي وعلوم البيانات",
      level: 2,
      guardian_name: "Khaled Salem",
      guardian_name_ar: "خالد سالم",
    },
    "01000001004",
  ),
  account(
    {
      id: "usr_student_5",
      role: Role.Student,
      name: "Hazem Wael Fouad",
      name_ar: "حازم وائل فؤاد",
      identifier: "250100105",
      faculty: "Artificial Intelligence & Data Science Technology Program",
      faculty_ar: "برنامج تكنولوجيا الذكاء الاصطناعي وعلوم البيانات",
      level: 2,
      guardian_name: "Wael Fouad",
      guardian_name_ar: "وائل فؤاد",
    },
    "01000001005",
  ),
  account(
    {
      id: "usr_student_6",
      role: Role.Student,
      name: "Nour Hesham Ragheb",
      name_ar: "نور هشام راغب",
      identifier: "250100106",
      faculty: "Computer Science Technology Program",
      faculty_ar: "برنامج تكنولوجيا علوم الحاسب",
      level: 2,
      guardian_name: "Hesham Ragheb",
      guardian_name_ar: "هشام راغب",
    },
    "01000001006",
  ),
  account(
    {
      id: "usr_student_7",
      role: Role.Student,
      name: "Malak Sherif Anwar",
      name_ar: "ملك شريف أنور",
      identifier: "240100107",
      faculty: "Computer Science Technology Program",
      faculty_ar: "برنامج تكنولوجيا علوم الحاسب",
      level: 3,
      guardian_name: "Sherif Anwar",
      guardian_name_ar: "شريف أنور",
    },
    "01000001007",
  ),
  account(
    {
      id: "usr_student_8",
      role: Role.Student,
      name: "Adham Medhat Saber",
      name_ar: "أدهم مدحت صابر",
      identifier: "240100108",
      faculty: "Artificial Intelligence & Data Science Technology Program",
      faculty_ar: "برنامج تكنولوجيا الذكاء الاصطناعي وعلوم البيانات",
      level: 3,
      guardian_name: "Medhat Saber",
      guardian_name_ar: "مدحت صابر",
    },
    "01000001008",
  ),
  account(
    {
      id: "usr_student_9",
      role: Role.Student,
      name: "Farida Tarek Helmy",
      name_ar: "فريدة طارق حلمي",
      identifier: "240100109",
      faculty: "Computer Science Technology Program",
      faculty_ar: "برنامج تكنولوجيا علوم الحاسب",
      level: 3,
      guardian_name: "Tarek Helmy",
      guardian_name_ar: "طارق حلمي",
    },
    "01000001009",
  ),
  account(
    {
      id: "usr_student_10",
      role: Role.Student,
      name: "Basel Ayman Shawky",
      name_ar: "باسل أيمن شوقي",
      identifier: "240100110",
      faculty: "Network and Cyber Security Technology Program",
      faculty_ar: "برنامج تكنولوجيا الشبكات والأمن السيبراني",
      level: 3,
      guardian_name: "Ayman Shawky",
      guardian_name_ar: "أيمن شوقي",
    },
    "01000001010",
  ),
  // Ziad's younger brother, so the guardian below has two children to switch between.
  account(
    {
      id: "usr_student_11",
      role: Role.Student,
      name: "Yassin Tamer Nour",
      name_ar: "ياسين تامر نور",
      identifier: "260100111",
      faculty: "Computer Science Technology Program",
      faculty_ar: "برنامج تكنولوجيا علوم الحاسب",
      level: 1,
      guardian_name: "Tamer Nour",
      guardian_name_ar: "تامر نور",
    },
    "01000001011",
  ),
  account(
    {
      id: "usr_parent_1",
      role: Role.Parent,
      name: "Tamer Nour",
      name_ar: "تامر نور",
      identifier: "01000002000",
    },
    "01000002000",
  ),
  account(
    {
      id: "usr_parent_2",
      role: Role.Parent,
      name: "Hossam Lotfy",
      name_ar: "حسام لطفي",
      identifier: "01000002001",
    },
    "01000002001",
  ),
  account(
    {
      id: "usr_driver_1",
      role: Role.Driver,
      name: "Kamal Ezzat",
      name_ar: "كمال عزت",
      identifier: "DRV-1001",
    },
    // Line 7's driver in the mock lines, so the crew pages match the line.
    "01000004008",
  ),
  account(
    {
      id: "usr_supervisor_1",
      role: Role.Supervisor,
      name: "Mona Adel",
      name_ar: "منى عادل",
      identifier: "SUP-1001",
    },
    "01000003002",
  ),
  account(
    {
      id: "usr_transport_1",
      role: Role.Transport,
      name: "Karim Fathy",
      name_ar: "كريم فتحي",
      identifier: "TRN-1001",
    },
    "01000003101",
  ),
  account(
    {
      id: "usr_finance_1",
      role: Role.Finance,
      name: "Nadia Samir",
      name_ar: "نادية سمير",
      identifier: "FIN-1001",
    },
    "01000003102",
  ),
  account(
    {
      id: "usr_clinic_1",
      role: Role.Clinic,
      name: "Dr. Salma Nabil",
      name_ar: "د. سلمى نبيل",
      identifier: "CLN-1001",
    },
    "01000003103",
  ),
  account(
    {
      id: "usr_affairs_1",
      role: Role.StudentAffairs,
      name: "Omar Khaled",
      name_ar: "عمر خالد",
      identifier: "STA-1001",
    },
    "01000003104",
  ),
  account(
    {
      id: "usr_sg_1",
      role: Role.SecretaryGeneral,
      name: "Dr. Hany Mostafa",
      name_ar: "د. هاني مصطفى",
      identifier: "SGO-1001",
    },
    "01000003105",
  ),
  account(
    {
      id: "usr_company_1",
      role: Role.BusCompany,
      name: "Abu El Hol desk",
      name_ar: "مكتب أبو الهول",
      identifier: "BUS-1001",
    },
    "01000003106",
  ),
  account(
    {
      id: "usr_admin_1",
      role: Role.SuperAdmin,
      name: "Mariam Hassan",
      name_ar: "مريم حسن",
      identifier: "ADM-1001",
    },
    "01000003100",
  ),
  account(
    {
      id: "usr_student_disabled",
      role: Role.Student,
      name: "Disabled Student",
      name_ar: "طالب موقوف",
      identifier: "240100000",
    },
    "01000009999",
    { disabled: true },
  ),
];

export function findMockAccount(identifier: string): MockAccount | undefined {
  const wanted = identifier.toUpperCase();
  return MOCK_ACCOUNTS.find((item) => item.user.identifier.toUpperCase() === wanted);
}

export function findMockAccountById(id: string): MockAccount | undefined {
  return MOCK_ACCOUNTS.find((item) => item.user.id === id);
}
