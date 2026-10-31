import { RequirePage } from "@/components/layout/RequirePage";
import { AdminPage } from "@/features/auth/permissions";
import { AdminRequestsScreen } from "@/features/requests/components/AdminRequestsScreen";

export default function Page() {
  return (
    <RequirePage page={AdminPage.Requests}>
      <AdminRequestsScreen />
    </RequirePage>
  );
}
