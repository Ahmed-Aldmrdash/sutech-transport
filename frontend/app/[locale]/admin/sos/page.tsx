import { RequirePage } from "@/components/layout/RequirePage";
import { AdminPage } from "@/features/auth/permissions";
import { AdminSosScreen } from "@/features/sos/components/AdminSosScreen";

export default function Page() {
  return (
    <RequirePage page={AdminPage.Sos}>
      <AdminSosScreen />
    </RequirePage>
  );
}
