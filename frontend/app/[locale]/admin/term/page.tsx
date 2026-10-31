import { RequirePage } from "@/components/layout/RequirePage";
import { AdminPage } from "@/features/auth/permissions";
import { AdminTermScreen } from "@/features/term/components/AdminTermScreen";

export default function Page() {
  return (
    <RequirePage page={AdminPage.Term}>
      <AdminTermScreen />
    </RequirePage>
  );
}
