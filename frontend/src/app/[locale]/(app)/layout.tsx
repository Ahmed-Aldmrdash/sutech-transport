import type { ReactNode } from "react";
import { SignedInFrame } from "@/features/auth/components/signed-in-frame";

/** Every role's pages. The frame checks the session and the role before anything renders. */
export default function SignedInLayout({ children }: { children: ReactNode }) {
  return <SignedInFrame>{children}</SignedInFrame>;
}
