import { Role } from "@/lib/auth/roles";
import type { User } from "./schema";

export interface MockAccount {
  user: User;
  /** The registered phone the code is "sent" to. */
  phone: string;
  disabled?: boolean;
}

/** Every mock account receives this code (the server would text a random one). */
export const MOCK_OTP_CODE = "4821";

const account = (
  user: Omit<User, "masked_phone">,
  phone: string,
  options: { disabled?: boolean } = {},
): MockAccount => ({ user: { ...user, masked_phone: maskPhone(phone) }, phone, ...options });

export function maskPhone(phone: string): string {
  return `${phone.slice(0, 3)}•••••${phone.slice(-3)}`;
}

/** One account per role, so every home and every guard can be tried without a server. */
export const MOCK_ACCOUNTS: readonly MockAccount[] = [
  account(
    {
      id: "usr_student_1",
      role: Role.Student,
      name: "Ahmed Aldmrdash",
      identifier: "240102791",
      faculty: "Faculty of Information Technology",
      level: 3,
      guardian_name: "Mohamed Aldmrdash",
    },
    "01012345907",
  ),
  account(
    { id: "usr_parent_1", role: Role.Parent, name: "Mohamed Aldmrdash", identifier: "01098765432" },
    "01098765432",
  ),
  account(
    { id: "usr_driver_1", role: Role.Driver, name: "Hassan Ibrahim", identifier: "DRV-1001" },
    "01111111234",
  ),
  account(
    { id: "usr_supervisor_1", role: Role.Supervisor, name: "Mona Adel", identifier: "SUP-1001" },
    "01111112345",
  ),
  account(
    { id: "usr_transport_1", role: Role.Transport, name: "Karim Fathy", identifier: "TRN-1001" },
    "01222221234",
  ),
  account(
    { id: "usr_finance_1", role: Role.Finance, name: "Nadia Samir", identifier: "FIN-1001" },
    "01222222345",
  ),
  account(
    { id: "usr_clinic_1", role: Role.Clinic, name: "Dr. Salma Nabil", identifier: "CLN-1001" },
    "01222223456",
  ),
  account(
    {
      id: "usr_affairs_1",
      role: Role.StudentAffairs,
      name: "Omar Khaled",
      identifier: "STA-1001",
    },
    "01222224567",
  ),
  account(
    {
      id: "usr_sg_1",
      role: Role.SecretaryGeneral,
      name: "Dr. Hany Mostafa",
      identifier: "SGO-1001",
    },
    "01222225678",
  ),
  account(
    { id: "usr_company_1", role: Role.BusCompany, name: "Abu El Hol desk", identifier: "BUS-1001" },
    "01222226789",
  ),
  account(
    { id: "usr_admin_1", role: Role.SuperAdmin, name: "Mariam Hassan", identifier: "ADM-1001" },
    "01000000001",
  ),
  account(
    {
      id: "usr_student_disabled",
      role: Role.Student,
      name: "Disabled Student",
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
