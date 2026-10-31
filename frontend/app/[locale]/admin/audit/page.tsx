import { RequirePage } from "@/components/layout/RequirePage";
import { AdminPage } from "@/features/auth/permissions";
import { AuditScreen } from "@/features/overview/components/AuditScreen";

export default function Page() {
  return (
    <RequirePage page={AdminPage.Audit}>
      <AuditScreen />
    </RequirePage>
  );
}
