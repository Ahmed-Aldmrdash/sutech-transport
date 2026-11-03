import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Tone } from "@/components/ui/tone";
import { RequestStatus } from "../schema";

export const REQUEST_STATUS_TONE: Record<RequestStatus, Tone> = {
  [RequestStatus.AwaitingGuardian]: Tone.Warning,
  [RequestStatus.Submitted]: Tone.Brand,
  [RequestStatus.InReview]: Tone.Info,
  [RequestStatus.Approved]: Tone.Success,
  [RequestStatus.Resolved]: Tone.Success,
  [RequestStatus.Rejected]: Tone.Danger,
  [RequestStatus.Withdrawn]: Tone.Neutral,
};

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  const t = useTranslations("student.requests.status");
  return <Badge tone={REQUEST_STATUS_TONE[status]}>{t(status)}</Badge>;
}
