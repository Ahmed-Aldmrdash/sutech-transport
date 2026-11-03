import type { ReactNode } from "react";
import { ChildrenProvider } from "@/features/children/components/children-provider";

/** Every guardian page shares one list of children and the child picked last. */
export default function ParentLayout({ children }: { children: ReactNode }) {
  return <ChildrenProvider>{children}</ChildrenProvider>;
}
