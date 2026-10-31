import { RequirePage } from "@/components/layout/RequirePage";
import { AdminPage } from "@/features/auth/permissions";
import { AdminStudentsScreen } from "@/features/students/components/AdminStudentsScreen";

export default function Page() {
  return (
    <RequirePage page={AdminPage.Students}>
      <AdminStudentsScreen />
    </RequirePage>
  );
}
