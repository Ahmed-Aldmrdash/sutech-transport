import { RequestKind } from "@/features/requests/schema";

/**
 * The office pages that show student requests. Transportation's "Requests" holds line changes
 * and model permits; "Refunds" is finance's; "Complaints" is shared, and the server gives each
 * office only its own (finance: payment complaints).
 */
export const DeskSection = {
  Requests: "requests",
  Refunds: "refunds",
  Complaints: "complaints",
} as const;
export type DeskSection = (typeof DeskSection)[keyof typeof DeskSection];

export const SECTION_KINDS: Record<DeskSection, RequestKind[]> = {
  [DeskSection.Requests]: [RequestKind.LineChange, RequestKind.ModelPermit],
  [DeskSection.Refunds]: [RequestKind.Refund],
  [DeskSection.Complaints]: [RequestKind.Complaint],
};

export function sectionHref(section: DeskSection, requestId?: string): string {
  return requestId ? `/admin/${section}/${encodeURIComponent(requestId)}` : `/admin/${section}`;
}
