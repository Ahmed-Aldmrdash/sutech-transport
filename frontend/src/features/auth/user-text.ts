import type { Locale } from "@/i18n/routing";
import { Role } from "@/lib/auth/roles";
import type { User } from "./schema";

type NamedUser = Pick<
  User,
  "name" | "name_ar" | "faculty" | "faculty_ar" | "guardian_name" | "guardian_name_ar"
>;

/** The account's name, faculty and guardian in the app's language, English when Arabic is missing. */
export function userText(user: NamedUser, locale: Locale) {
  const arabic = locale === "ar";
  return {
    name: (arabic && user.name_ar) || user.name,
    faculty: (arabic && user.faculty_ar) || user.faculty || null,
    guardianName: (arabic && user.guardian_name_ar) || user.guardian_name || null,
  };
}

/** Accounts that are a desk, not a person: greeted by the whole name ("Abu El Hol desk"). */
const DESK_ROLES: readonly User["role"][] = [Role.BusCompany];

/** The name to greet the account by: a person's first name, a desk's full name. */
export function greetingNameOf(user: NamedUser & Pick<User, "role">, locale: Locale): string {
  const { name } = userText(user, locale);
  return DESK_ROLES.includes(user.role) ? name : firstNameOf(name);
}

/** First name for greetings ("Dr." is skipped). */
export function firstNameOf(name: string): string {
  const words = name.replace(/^(Dr\.|د\.)\s*/, "").split(" ");
  return words[0] ?? name;
}
