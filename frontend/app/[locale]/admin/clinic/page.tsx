import { RequirePage } from "@/components/layout/RequirePage";
import { AdminPage } from "@/features/auth/permissions";
import { ClinicScreen } from "@/features/clinic/components/ClinicScreen";

export default function Page() {
  return (
    <RequirePage page={AdminPage.Clinic}>
      <ClinicScreen />
    </RequirePage>
  );
}
