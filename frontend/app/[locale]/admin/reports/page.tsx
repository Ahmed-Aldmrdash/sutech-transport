import { RequirePage } from "@/components/layout/RequirePage";
import { AdminPage } from "@/features/auth/permissions";
import { ReportsScreen } from "@/features/reports/components/ReportsScreen";

export default function Page() {
  return (
    <RequirePage page={AdminPage.Reports}>
      <ReportsScreen />
    </RequirePage>
  );
}
