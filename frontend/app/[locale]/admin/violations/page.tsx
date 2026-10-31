import { RequirePage } from "@/components/layout/RequirePage";
import { AdminPage } from "@/features/auth/permissions";
import { AdminViolationsScreen } from "@/features/violations/components/AdminViolationsScreen";

export default function Page() {
  return (
    <RequirePage page={AdminPage.Violations}>
      <AdminViolationsScreen />
    </RequirePage>
  );
}
