import { RequirePage } from "@/components/layout/RequirePage";
import { AdminPage } from "@/features/auth/permissions";
import { AdminComplaintsScreen } from "@/features/complaints/components/AdminComplaintsScreen";

export default function Page() {
  return (
    <RequirePage page={AdminPage.Complaints}>
      <AdminComplaintsScreen />
    </RequirePage>
  );
}
