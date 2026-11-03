import {
  ArrowLeftRight,
  MessageSquareWarning,
  Package,
  ReceiptText,
  type LucideIcon,
} from "lucide-react";
import { RequestKind } from "../schema";

export const REQUEST_KIND_ICON: Record<RequestKind, LucideIcon> = {
  [RequestKind.LineChange]: ArrowLeftRight,
  [RequestKind.Refund]: ReceiptText,
  [RequestKind.Complaint]: MessageSquareWarning,
  [RequestKind.ModelPermit]: Package,
};
