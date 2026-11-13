import { z } from "zod";
import { isoDateTime } from "@/lib/api/iso-datetime";
import { Role } from "@/lib/auth/roles";

/**
 * The super admin's own pages: the office accounts (who may sign in to which office) and the
 * activity log of every decision the offices took. Students, guardians and crews are not
 * managed here: they come from the university's records and the bus company's list.
 */

/** The offices a staff account can belong to. */
export const STAFF_ROLES = [
  Role.Transport,
  Role.Finance,
  Role.Clinic,
  Role.StudentAffairs,
  Role.SecretaryGeneral,
  Role.BusCompany,
  Role.SuperAdmin,
] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

/** The sign-in ID prefix per office: a new account gets the next number, e.g. FIN-1002. */
export const STAFF_ID_PREFIX: Record<StaffRole, string> = {
  [Role.Transport]: "TRN",
  [Role.Finance]: "FIN",
  [Role.Clinic]: "CLN",
  [Role.StudentAffairs]: "STA",
  [Role.SecretaryGeneral]: "SGO",
  [Role.BusCompany]: "BUS",
  [Role.SuperAdmin]: "ADM",
};

export const AdminSystemErrorCode = {
  /** Another account already uses this phone. */
  PhoneTaken: "PHONE_TAKEN",
  /** The super admin can't stop their own account or change its office. */
  CannotChangeSelf: "CANNOT_CHANGE_SELF",
  /** Stopping it would leave no active super admin. */
  LastSuperAdmin: "LAST_SUPER_ADMIN",
  UserNotFound: "USER_NOT_FOUND",
} as const;
export type AdminSystemErrorCode = (typeof AdminSystemErrorCode)[keyof typeof AdminSystemErrorCode];

const NAME_MIN_LENGTH = 3;
const NAME_MAX_LENGTH = 60;
const SEARCH_MAX_LENGTH = 60;
export const AUDIT_PAGE_SIZE = 25;

/** An Egyptian mobile number: 11 digits starting 010, 011, 012 or 015. */
export const PHONE_PATTERN = /^01[0125]\d{8}$/;

const staffRoleSchema = z.enum(STAFF_ROLES);

export const staffUserSchema = z.object({
  user_id: z.string(),
  /** What they type to sign in, e.g. TRN-1001. */
  identifier: z.string(),
  name: z.string(),
  role: staffRoleSchema,
  /** Masked, as on the sign-in screen. */
  masked_phone: z.string(),
  active: z.boolean(),
  /** The signed-in super admin: they can't stop themselves or change their office. */
  is_you: z.boolean(),
  /** Added by a super admin (not from the first setup). */
  added_at: isoDateTime().nullable(),
});
export type StaffUser = z.infer<typeof staffUserSchema>;

export const staffUsersQuerySchema = z.object({
  q: z.string().trim().max(SEARCH_MAX_LENGTH).optional(),
  role: staffRoleSchema.optional(),
});
export type StaffUsersQuery = z.input<typeof staffUsersQuerySchema>;

export const staffUsersSchema = z.object({
  items: z.array(staffUserSchema),
  /** Accounts per office, for the filter. */
  counts: z.record(z.string(), z.number().int().nonnegative()),
});
export type StaffUsers = z.infer<typeof staffUsersSchema>;

export const newStaffUserSchema = z.object({
  name: z.string().trim().min(NAME_MIN_LENGTH).max(NAME_MAX_LENGTH),
  /** The name in Arabic; the English one is used when it's empty. */
  name_ar: z.string().trim().max(NAME_MAX_LENGTH).nullable(),
  phone: z.string().regex(PHONE_PATTERN),
  role: staffRoleSchema,
});
export type NewStaffUser = z.infer<typeof newStaffUserSchema>;

export const staffUserParamsSchema = z.object({ user_id: z.string().min(1) });

export const staffUserChangeSchema = z
  .object({ active: z.boolean().optional(), role: staffRoleSchema.optional() })
  .refine((body) => body.active !== undefined || body.role !== undefined);
export type StaffUserChange = z.infer<typeof staffUserChangeSchema>;

// ---------------------------------------------------------------------------------------------
// Activity log

/** What was done, grouped by area for the filter. */
export const AuditArea = {
  Payments: "payments",
  Requests: "requests",
  Violations: "violations",
  Announcements: "announcements",
  Emergencies: "emergencies",
  Events: "events",
  Users: "users",
  Timetable: "timetable",
} as const;
export type AuditArea = (typeof AuditArea)[keyof typeof AuditArea];
export const AUDIT_AREAS = Object.values(AuditArea) as [AuditArea, ...AuditArea[]];

export const AuditAction = {
  PaymentApproved: "payment_approved",
  PaymentRejected: "payment_rejected",
  OfficePayment: "office_payment",
  RequestOpened: "request_opened",
  RequestApproved: "request_approved",
  RequestRejected: "request_rejected",
  RequestResolved: "request_resolved",
  ViolationOpened: "violation_opened",
  ViolationClosed: "violation_closed",
  AnnouncementPosted: "announcement_posted",
  SosAction: "sos_action",
  ReplacementSent: "replacement_sent",
  EventRequested: "event_requested",
  EventCancelled: "event_cancelled",
  EventConfirmed: "event_confirmed",
  EventDeclined: "event_declined",
  UserAdded: "user_added",
  UserStopped: "user_stopped",
  UserActivated: "user_activated",
  UserRoleChanged: "user_role_changed",
  ReturnTimeChanged: "return_time_changed",
} as const;
export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];
const AUDIT_ACTIONS = Object.values(AuditAction) as [AuditAction, ...AuditAction[]];

export const AUDIT_AREA_OF: Record<AuditAction, AuditArea> = {
  [AuditAction.PaymentApproved]: AuditArea.Payments,
  [AuditAction.PaymentRejected]: AuditArea.Payments,
  [AuditAction.OfficePayment]: AuditArea.Payments,
  [AuditAction.RequestOpened]: AuditArea.Requests,
  [AuditAction.RequestApproved]: AuditArea.Requests,
  [AuditAction.RequestRejected]: AuditArea.Requests,
  [AuditAction.RequestResolved]: AuditArea.Requests,
  [AuditAction.ViolationOpened]: AuditArea.Violations,
  [AuditAction.ViolationClosed]: AuditArea.Violations,
  [AuditAction.AnnouncementPosted]: AuditArea.Announcements,
  [AuditAction.SosAction]: AuditArea.Emergencies,
  [AuditAction.ReplacementSent]: AuditArea.Emergencies,
  [AuditAction.EventRequested]: AuditArea.Events,
  [AuditAction.EventCancelled]: AuditArea.Events,
  [AuditAction.EventConfirmed]: AuditArea.Events,
  [AuditAction.EventDeclined]: AuditArea.Events,
  [AuditAction.UserAdded]: AuditArea.Users,
  [AuditAction.UserStopped]: AuditArea.Users,
  [AuditAction.UserActivated]: AuditArea.Users,
  [AuditAction.UserRoleChanged]: AuditArea.Users,
  [AuditAction.ReturnTimeChanged]: AuditArea.Timetable,
};

export const auditQuerySchema = z.object({
  area: z.enum(AUDIT_AREAS).optional(),
  /** Who did it, or what it was about. */
  q: z.string().trim().max(SEARCH_MAX_LENGTH).optional(),
  page: z.coerce.number().int().positive().optional(),
});
export type AuditQuery = z.input<typeof auditQuerySchema>;

export const auditEntrySchema = z.object({
  audit_id: z.string(),
  at: isoDateTime(),
  actor: z.object({ name: z.string(), identifier: z.string(), role: z.enum(Role) }),
  action: z.enum(AUDIT_ACTIONS),
  area: z.enum(AUDIT_AREAS),
  /** What it was about: "REQ-2026-0012 · Seif Hossam Lotfy", "Line 7". */
  target: z.string(),
  /** The note or reason given, if any. */
  detail: z.string().nullable(),
});
export type AuditEntry = z.infer<typeof auditEntrySchema>;

export const auditLogSchema = z.object({
  items: z.array(auditEntrySchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  page_size: z.number().int().positive(),
});
export type AuditLog = z.infer<typeof auditLogSchema>;
