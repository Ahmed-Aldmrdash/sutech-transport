import { RequirePage } from "@/components/layout/RequirePage";
import { AdminPage } from "@/features/auth/permissions";
import { AdminBusesScreen } from "@/features/fleet/components/AdminBusesScreen";

export default function Page() {
  return (
    <RequirePage page={AdminPage.Buses}>
      <AdminBusesScreen />
    </RequirePage>
  );
}
