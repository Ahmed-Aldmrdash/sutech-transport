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
 * students are the project team (Ahmed's list, 2026-11-02); Omar is the active subscriber.
 */
export const MOCK_ACCOUNTS: readonly MockAccount[] = [
  account(
    {
      id: "usr_student_1",
      role: Role.Student,
      name: "Ahmed Mohamed Fathy Aldmrdash",
      name_ar: "أحمد محمد فتحي الدمرداش",
      identifier: "240102791",
      faculty: "Artificial Intelligence & Data Science Technology Program",
      faculty_ar: "برنامج تكنولوجيا الذكاء الاصطناعي وعلوم البيانات",
      level: 3,
      guardian_name: "Mohamed Fathy Aldmrdash",
      guardian_name_ar: "محمد فتحي الدمرداش",
    },
    "01098861907",
  ),
  account(
    {
      id: "usr_student_2",
      role: Role.Student,
      name: "Omar Ahmed Ramadan Ramadan",
      name_ar: "عمر أحمد رمضان رمضان",
      identifier: "240102684",
      faculty: "Artificial Intelligence & Data Science Technology Program",
      faculty_ar: "برنامج تكنولوجيا الذكاء الاصطناعي وعلوم البيانات",
      level: 3,
      guardian_name: "Ahmed Ramadan Ramadan",
      guardian_name_ar: "أحمد رمضان رمضان",
    },
    "01090892631",
  ),
  account(
    {
      id: "usr_student_3",
      role: Role.Student,
      name: "Abanoub Reda Abdelsayed",
      name_ar: "أبانوب رضا عبد السيد",
      identifier: "250102519",
      faculty: "Artificial Intelligence & Data Science Technology Program",
      faculty_ar: "برنامج تكنولوجيا الذكاء الاصطناعي وعلوم البيانات",
      level: 2,
      guardian_name: "Reda Abdelsayed",
      guardian_name_ar: "رضا عبد السيد",
    },
    "01223567069",
  ),
  account(
    {
      id: "usr_student_4",
      role: Role.Student,
      name: "Abdullah Mohammed Ahmed",
      name_ar: "عبد الله محمد أحمد",
      identifier: "250101850",
      faculty: "Artificial Intelligence & Data Science Technology Program",
      faculty_ar: "برنامج تكنولوجيا الذكاء الاصطناعي وعلوم البيانات",
      level: 2,
      guardian_name: "Mohammed Ahmed",
      guardian_name_ar: "محمد أحمد",
    },
    "01011665173",
  ),
  account(
    {
      id: "usr_student_5",
      role: Role.Student,
      name: "Ahmed Shafiq Ragab",
      name_ar: "أحمد شفيق رجب",
      identifier: "250102374",
      faculty: "Artificial Intelligence & Data Science Technology Program",
      faculty_ar: "برنامج تكنولوجيا الذكاء الاصطناعي وعلوم البيانات",
      level: 2,
      guardian_name: "Shafiq Ragab",
      guardian_name_ar: "شفيق رجب",
    },
    "01013667458",
  ),
  account(
    {
      id: "usr_student_6",
      role: Role.Student,
      name: "Mohamed Nabile Arafa",
      name_ar: "محمد نبيل عرفة",
      identifier: "250100665",
      faculty: "Computer Science Technology Program",
      faculty_ar: "برنامج تكنولوجيا علوم الحاسب",
      level: 2,
      guardian_name: "Nabile Arafa",
      guardian_name_ar: "نبيل عرفة",
    },
    "01147927194",
  ),
  // No phone in the team list yet: placeholder.
  account(
    {
      id: "usr_student_7",
      role: Role.Student,
      name: "Mohamed Ali Mohamed Ali",
      name_ar: "محمد علي محمد علي",
      identifier: "240103524",
      faculty: "Computer Science Technology Program",
      faculty_ar: "برنامج تكنولوجيا علوم الحاسب",
      level: 3,
      guardian_name: "Ali Mohamed Ali",
      guardian_name_ar: "علي محمد علي",
    },
    "01000003524",
  ),
  account(
    {
      id: "usr_student_8",
      role: Role.Student,
      name: "Moaaz Abd Aljawwad",
      name_ar: "معاذ عبد الجواد",
      identifier: "240100323",
      faculty: "Artificial Intelligence & Data Science Technology Program",
      faculty_ar: "برنامج تكنولوجيا الذكاء الاصطناعي وعلوم البيانات",
      level: 3,
      guardian_name: "Abd Aljawwad",
      guardian_name_ar: "عبد الجواد",
    },
    "01020841211",
  ),
  account(
    {
      id: "usr_student_9",
      role: Role.Student,
      name: "Shimaa Hussien",
      name_ar: "شيماء حسين",
      identifier: "240102170",
      faculty: "Computer Science Technology Program",
      faculty_ar: "برنامج تكنولوجيا علوم الحاسب",
      level: 3,
      guardian_name: "Hussien",
      guardian_name_ar: "حسين",
    },
    "01029451055",
  ),
  // No phone in the team list yet: placeholder.
  account(
    {
      id: "usr_student_10",
      role: Role.Student,
      name: "Mahmoud Hamada",
      name_ar: "محمود حمادة",
      identifier: "240102658",
      faculty: "Network and Cyber Security Technology Program",
      faculty_ar: "برنامج تكنولوجيا الشبكات والأمن السيبراني",
      level: 3,
      guardian_name: "Hamada",
      guardian_name_ar: "حمادة",
    },
    "01000002658",
  ),
  // Demo only: Ahmed's younger brother, so the guardian below has two children to switch between.
  account(
    {
      id: "usr_student_11",
      role: Role.Student,
      name: "Youssef Mohamed Fathy Aldmrdash",
      name_ar: "يوسف محمد فتحي الدمرداش",
      identifier: "260101207",
      faculty: "Computer Science Technology Program",
      faculty_ar: "برنامج تكنولوجيا علوم الحاسب",
      level: 1,
      guardian_name: "Mohamed Fathy Aldmrdash",
      guardian_name_ar: "محمد فتحي الدمرداش",
    },
    "01098861908",
  ),
  account(
    {
      id: "usr_parent_1",
      role: Role.Parent,
      name: "Mohamed Fathy Aldmrdash",
      name_ar: "محمد فتحي الدمرداش",
      identifier: "01098765432",
    },
    "01098765432",
  ),
  account(
    {
      id: "usr_driver_1",
      role: Role.Driver,
      name: "Mohamed Hassan",
      name_ar: "محمد حسن",
      identifier: "DRV-1001",
    },
    // Line 7's driver from the Abu El Hol drivers list, so the crew pages match the line.
    "01006796783",
  ),
  account(
    {
      id: "usr_supervisor_1",
      role: Role.Supervisor,
      name: "Mona Adel",
      name_ar: "منى عادل",
      identifier: "SUP-1001",
    },
    "01111112345",
  ),
  account(
    {
      id: "usr_transport_1",
      role: Role.Transport,
      name: "Karim Fathy",
      name_ar: "كريم فتحي",
      identifier: "TRN-1001",
    },
    "01222221234",
  ),
  account(
    {
      id: "usr_finance_1",
      role: Role.Finance,
      name: "Nadia Samir",
      name_ar: "نادية سمير",
      identifier: "FIN-1001",
    },
    "01222222345",
  ),
  account(
    {
      id: "usr_clinic_1",
      role: Role.Clinic,
      name: "Dr. Salma Nabil",
      name_ar: "د. سلمى نبيل",
      identifier: "CLN-1001",
    },
    "01222223456",
  ),
  account(
    {
      id: "usr_affairs_1",
      role: Role.StudentAffairs,
      name: "Omar Khaled",
      name_ar: "عمر خالد",
      identifier: "STA-1001",
    },
    "01222224567",
  ),
  account(
    {
      id: "usr_sg_1",
      role: Role.SecretaryGeneral,
      name: "Dr. Hany Mostafa",
      name_ar: "د. هاني مصطفى",
      identifier: "SGO-1001",
    },
    "01222225678",
  ),
  account(
    {
      id: "usr_company_1",
      role: Role.BusCompany,
      name: "Abu El Hol desk",
      name_ar: "مكتب أبو الهول",
      identifier: "BUS-1001",
    },
    "01222226789",
  ),
  account(
    {
      id: "usr_admin_1",
      role: Role.SuperAdmin,
      name: "Mariam Hassan",
      name_ar: "مريم حسن",
      identifier: "ADM-1001",
    },
    "01000000001",
  ),
  account(
    {
      id: "usr_student_disabled",
      role: Role.Student,
      name: "Disabled Student",
      name_ar: "طالب موقوف",
      identifier: "240100000",
    },
    "01000000999",
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
