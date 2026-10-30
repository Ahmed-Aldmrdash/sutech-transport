import { RequirePage } from "@/components/layout/RequirePage";
import { AdminPage } from "@/features/auth/permissions";
import { OverviewScreen } from "@/features/overview/components/OverviewScreen";

export default function Page() {
  return (
    <RequirePage page={AdminPage.Overview}>
      <OverviewScreen />
    </RequirePage>
  );
}
