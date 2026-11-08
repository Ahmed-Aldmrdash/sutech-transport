import { z } from "zod";

/**
 * The university's "Code of Conduct on University Buses" (Transportation Department, received
 * 2026-11-02). Each value is the rule a violation breaks; `CONDUCT_RULE_NUMBER` gives its
 * number in the document. Penalties are still to come from the office.
 */
export const ConductRule = {
  /** Rule 2: a project model on the bus without the Safety and Transportation approval. */
  UnapprovedModel: "unapproved_model",
  /** Rule 3: photographing a passenger without permission. */
  Photographing: "photographing",
  /** Rule 4: bullying, mocking or ridiculing a passenger. */
  Bullying: "bullying",
  /** Rule 5: feet on the seats, eating or drinking on board. */
  Cleanliness: "cleanliness",
  /** Rule 6: smoking, e-cigarettes included. */
  Smoking: "smoking",
  /** Rule 7: loud music, films or other disturbing audio. */
  Noise: "noise",
  /** Rule 9: forcing the door, boarding or getting off while the bus moves. */
  UnsafeBoarding: "unsafe_boarding",
  /** Rule 10: refused to show the student ID when asked. */
  RefusedId: "refused_id",
  /** Rule 11: obscene or offensive language or behaviour. */
  BadLanguage: "bad_language",
  /** Rule 12: riding without a paid subscription. */
  NotSubscribed: "not_subscribed",
  /** Rule 14: distracting the driver. */
  DistractingDriver: "distracting_driver",
  /** Rule 15: breaking or damaging the bus or its seats (the student pays the repair). */
  Damage: "damage",
  /** Rule 16: not keeping the assigned seat. */
  Seating: "seating",
  Other: "other",
} as const;
export type ConductRule = (typeof ConductRule)[keyof typeof ConductRule];
export const CONDUCT_RULES = Object.values(ConductRule) as [ConductRule, ...ConductRule[]];

export const CONDUCT_RULE_NUMBER: Record<ConductRule, number | null> = {
  [ConductRule.UnapprovedModel]: 2,
  [ConductRule.Photographing]: 3,
  [ConductRule.Bullying]: 4,
  [ConductRule.Cleanliness]: 5,
  [ConductRule.Smoking]: 6,
  [ConductRule.Noise]: 7,
  [ConductRule.UnsafeBoarding]: 9,
  [ConductRule.RefusedId]: 10,
  [ConductRule.BadLanguage]: 11,
  [ConductRule.NotSubscribed]: 12,
  [ConductRule.DistractingDriver]: 14,
  [ConductRule.Damage]: 15,
  [ConductRule.Seating]: 16,
  [ConductRule.Other]: null,
};

/** submitted → under_review (Student Affairs / Transport) → closed. */
export const ViolationStatus = {
  Submitted: "submitted",
  UnderReview: "under_review",
  Closed: "closed",
} as const;
export type ViolationStatus = (typeof ViolationStatus)[keyof typeof ViolationStatus];
const VIOLATION_STATUSES = Object.values(ViolationStatus) as [
  ViolationStatus,
  ...ViolationStatus[],
];

export const ViolationErrorCode = {
  StudentNotFound: "STUDENT_NOT_FOUND",
  /** Photos only: JPEG, PNG or WebP. */
  FileType: "FILE_TYPE",
  FileTooLarge: "FILE_TOO_LARGE",
} as const;

export const VIOLATION_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const VIOLATION_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const VIOLATION_DESCRIPTION_MIN_LENGTH = 10;
export const VIOLATION_DESCRIPTION_MAX_LENGTH = 500;

const violationPhotoSchema = z.object({
  file_name: z.string().min(1).max(200),
  content_type: z.enum(VIOLATION_PHOTO_TYPES),
  /** The photo itself, base64 (no "data:" prefix). At most 5 MB before encoding. */
  data_base64: z.string().min(1),
});

export const createViolationBodySchema = z.object({
  /** Today's trip, when it happened on one. */
  trip_id: z.string().min(1).nullable(),
  /** University ID, when the crew knows who it was. */
  student_identifier: z.string().trim().min(1).max(20).nullable(),
  rule: z.enum(CONDUCT_RULES),
  description: z
    .string()
    .trim()
    .min(VIOLATION_DESCRIPTION_MIN_LENGTH)
    .max(VIOLATION_DESCRIPTION_MAX_LENGTH),
  /** The plan asks for a photo with every violation. */
  photo: violationPhotoSchema,
});
export type CreateViolationBody = z.infer<typeof createViolationBodySchema>;

export const violationSchema = z.object({
  violation_id: z.string(),
  rule: z.enum(CONDUCT_RULES),
  /** null when the crew didn't know who it was. Name in the request's language. */
  student: z
    .object({ student_id: z.string(), name: z.string(), identifier: z.string() })
    .nullable(),
  trip_id: z.string().nullable(),
  description: z.string(),
  photo_name: z.string(),
  status: z.enum(VIOLATION_STATUSES),
  created_at: z.iso.datetime(),
});
export type Violation = z.infer<typeof violationSchema>;

export const myViolationsSchema = z.object({ items: z.array(violationSchema) });
export type MyViolations = z.infer<typeof myViolationsSchema>;
