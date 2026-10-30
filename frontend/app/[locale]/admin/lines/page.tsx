import { RequirePage } from "@/components/layout/RequirePage";
import { AdminPage } from "@/features/auth/permissions";
import { AdminLinesScreen } from "@/features/fleet/components/AdminLinesScreen";

export default function Page() {
  return (
    <RequirePage page={AdminPage.Lines}>
      <AdminLinesScreen />
    </RequirePage>
  );
}
