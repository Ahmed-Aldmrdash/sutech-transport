import { RequirePage } from "@/components/layout/RequirePage";
import { AdminPage } from "@/features/auth/permissions";
import { AdminDeparturesScreen } from "@/features/departures/components/AdminDeparturesScreen";

export default function Page() {
  return (
    <RequirePage page={AdminPage.Departures}>
      <AdminDeparturesScreen />
    </RequirePage>
  );
}
